import type { FastifyPluginAsync } from "fastify";
import ExcelJS from "exceljs";
import { and, eq, gte, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { accounts, workShifts } from "../db/schema.js";

type ShiftBody = { employeeId: string; startsAt: string; endsAt: string; breakMinutes: number; note?: string };
const scheduleLock = 94712065;

function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 1) - 7 * 60 * 60 * 1000),
    to: new Date(Date.UTC(year, monthNumber, 1) - 7 * 60 * 60 * 1000),
  };
}

async function payrollForMonth(month: string) {
  const range = monthRange(month);
  if (!range) return null;
  return db.select({
    id: accounts.id,
    displayName: accounts.displayName,
    username: accounts.username,
    hourlyRateVnd: sql<number>`coalesce(round(sum((extract(epoch from (${workShifts.endsAt} - ${workShifts.startsAt})) / 3600 - ${workShifts.breakMinutes}::numeric / 60) * ${workShifts.hourlyRateVnd}) / nullif(sum(extract(epoch from (${workShifts.endsAt} - ${workShifts.startsAt})) / 3600 - ${workShifts.breakMinutes}::numeric / 60), 0)), ${accounts.hourlyRateVnd})`.mapWith(Number),
    shiftCount: sql<number>`count(${workShifts.id})`.mapWith(Number),
    hoursWorked: sql<number>`coalesce(sum(extract(epoch from (${workShifts.endsAt} - ${workShifts.startsAt})) / 3600 - ${workShifts.breakMinutes}::numeric / 60), 0)`.mapWith(Number),
    amountVnd: sql<number>`coalesce(round(sum((extract(epoch from (${workShifts.endsAt} - ${workShifts.startsAt})) / 3600 - ${workShifts.breakMinutes}::numeric / 60) * ${workShifts.hourlyRateVnd}), 0), 0)`.mapWith(Number),
  }).from(accounts).leftJoin(workShifts, and(
    eq(workShifts.employeeId, accounts.id), gte(workShifts.startsAt, range.from), lt(workShifts.startsAt, range.to),
  )).where(inArray(accounts.role, ["manager", "cashier"]))
    .groupBy(accounts.id).orderBy(accounts.displayName);
}

export const workforceRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { from: string; to: string } }>("/work-shifts", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role !== "owner") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Chỉ chủ cửa hàng được xếp lịch." } });
    const from = new Date(request.query.from);
    const to = new Date(request.query.to);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 8 * 86400000) {
      return reply.code(400).send({ error: { code: "INVALID_WEEK", message: "Khoảng thời gian lịch làm việc không hợp lệ." } });
    }
    const shifts = await db.select({
      id: workShifts.id,
      employeeId: workShifts.employeeId,
      employeeName: accounts.displayName,
      startsAt: workShifts.startsAt,
      endsAt: workShifts.endsAt,
      breakMinutes: workShifts.breakMinutes,
      hourlyRateVnd: workShifts.hourlyRateVnd,
      note: workShifts.note,
    }).from(workShifts).innerJoin(accounts, eq(accounts.id, workShifts.employeeId))
      .where(and(gte(workShifts.startsAt, from), lt(workShifts.startsAt, to)))
      .orderBy(workShifts.startsAt, accounts.displayName);
    return { shifts };
  });

  app.post<{ Body: ShiftBody }>("/work-shifts", {
    schema: { body: {
      type: "object", additionalProperties: false,
      required: ["employeeId", "startsAt", "endsAt", "breakMinutes"],
      properties: {
        employeeId: { type: "string", format: "uuid" },
        startsAt: { type: "string", format: "date-time" },
        endsAt: { type: "string", format: "date-time" },
        breakMinutes: { type: "integer", minimum: 0, maximum: 240 },
        note: { type: "string", maxLength: 500 },
      },
    } },
  }, async (request, reply) => {
    const owner = await getSessionAccount(request);
    if (!owner) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (owner.role !== "owner") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Chỉ chủ cửa hàng được xếp lịch." } });
    const startsAt = new Date(request.body.startsAt);
    const endsAt = new Date(request.body.endsAt);
    const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60000;
    if (durationMinutes <= 0 || durationMinutes > 16 * 60 || request.body.breakMinutes >= durationMinutes) {
      return reply.code(422).send({ error: { code: "INVALID_SHIFT_TIME", message: "Giờ kết thúc phải sau giờ bắt đầu; ca tối đa 16 giờ và nghỉ ngắn hơn ca." } });
    }

    const shift = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${scheduleLock})`);
      const [employee] = await tx.select({ id: accounts.id, hourlyRateVnd: accounts.hourlyRateVnd })
        .from(accounts).where(and(eq(accounts.id, request.body.employeeId), eq(accounts.isActive, true), inArray(accounts.role, ["manager", "cashier"]))).limit(1);
      if (!employee) throw Object.assign(new Error("Nhân viên không hoạt động hoặc không tồn tại."), { statusCode: 404, code: "EMPLOYEE_NOT_FOUND" });
      const [conflict] = await tx.select({ id: workShifts.id }).from(workShifts)
        .where(and(eq(workShifts.employeeId, employee.id), lt(workShifts.startsAt, endsAt), gt(workShifts.endsAt, startsAt))).limit(1);
      if (conflict) throw Object.assign(new Error("Nhân viên đã có ca trùng giờ."), { statusCode: 409, code: "SHIFT_CONFLICT" });
      const [created] = await tx.insert(workShifts).values({
        employeeId: employee.id, createdByName: owner.displayName, startsAt, endsAt,
        breakMinutes: request.body.breakMinutes, hourlyRateVnd: employee.hourlyRateVnd,
        note: request.body.note?.trim() || null,
      }).returning({ id: workShifts.id });
      return created;
    });
    return reply.code(201).send({ shift });
  });

  app.delete<{ Params: { id: string } }>("/work-shifts/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role !== "owner") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Chỉ chủ cửa hàng được sửa lịch." } });
    const [deleted] = await db.delete(workShifts).where(eq(workShifts.id, request.params.id)).returning({ id: workShifts.id });
    if (!deleted) return reply.code(404).send({ error: { code: "SHIFT_NOT_FOUND", message: "Không tìm thấy ca làm." } });
    return reply.code(204).send();
  });

  app.get<{ Querystring: { month: string } }>("/payroll", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role !== "owner") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Chỉ chủ cửa hàng được xem bảng lương." } });
    const employees = await payrollForMonth(request.query.month);
    if (!employees) return reply.code(400).send({ error: { code: "INVALID_MONTH", message: "Tháng không hợp lệ." } });
    return { month: request.query.month, employees };
  });

  app.get<{ Querystring: { month: string } }>("/payroll/export", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role !== "owner") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Chỉ chủ cửa hàng được tải bảng lương." } });
    const employees = await payrollForMonth(request.query.month);
    if (!employees) return reply.code(400).send({ error: { code: "INVALID_MONTH", message: "Tháng không hợp lệ." } });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CỘI Coffee & Beer";
    workbook.subject = `Bảng lương ${request.query.month}`;
    const sheet = workbook.addWorksheet("Bảng lương", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      { header: "Nhân viên", key: "name", width: 28 },
      { header: "Tên đăng nhập", key: "username", width: 20 },
      { header: "Số ca", key: "shifts", width: 12 },
      { header: "Giờ tính lương", key: "hours", width: 18 },
      { header: "Đơn giá/giờ (VND)", key: "rate", width: 22 },
      { header: "Lương tháng (VND)", key: "amount", width: 22 },
    ];
    sheet.addRows(employees.map((employee) => ({
      name: employee.displayName, username: employee.username, shifts: employee.shiftCount,
      hours: Number(employee.hoursWorked.toFixed(2)), rate: employee.hourlyRateVnd, amount: employee.amountVnd,
    })));
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: "A1", to: "F1" };
    const buffer = await workbook.xlsx.writeBuffer();
    return reply.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("content-disposition", `attachment; filename="payroll-${request.query.month}.xlsx"`)
      .send(Buffer.from(buffer));
  });
};
