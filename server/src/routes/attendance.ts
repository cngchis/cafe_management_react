import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { accounts, attendanceRecords, auditLogs } from "../db/schema.js";

export const attendanceRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { from?: string; to?: string } }>("/attendance", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const canViewAll = account.role === "owner" || account.role === "manager";
    const from = request.query.from ? new Date(request.query.from) : new Date(Date.now() - 30 * 86400000);
    const to = request.query.to ? new Date(request.query.to) : new Date(Date.now() + 86400000);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 93 * 86400000) {
      return reply.code(400).send({ error: { code: "INVALID_RANGE", message: "Khoảng thời gian chấm công không hợp lệ." } });
    }
    const records = await db.select({
      id: attendanceRecords.id, employeeId: attendanceRecords.employeeId, employeeName: accounts.displayName,
      clockInAt: attendanceRecords.clockInAt, clockOutAt: attendanceRecords.clockOutAt,
      note: attendanceRecords.note,
    }).from(attendanceRecords).innerJoin(accounts, eq(accounts.id, attendanceRecords.employeeId))
      .where(and(canViewAll ? undefined : eq(attendanceRecords.employeeId, account.id), gte(attendanceRecords.clockInAt, from), lt(attendanceRecords.clockInAt, to)))
      .orderBy(desc(attendanceRecords.clockInAt)).limit(canViewAll ? 500 : 50);
    const [open] = await db.select({ id: attendanceRecords.id, clockInAt: attendanceRecords.clockInAt })
      .from(attendanceRecords).where(and(eq(attendanceRecords.employeeId, account.id), sql`${attendanceRecords.clockOutAt} IS NULL`)).limit(1);
    return { records, current: open ?? null };
  });

  app.post("/attendance/clock-in", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    try {
      const [record] = await db.transaction(async (tx) => {
        const [created] = await tx.insert(attendanceRecords).values({ employeeId: account.id, recordedByAccountId: account.id })
          .returning({ id: attendanceRecords.id, clockInAt: attendanceRecords.clockInAt });
        await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "clocked_in", entityType: "attendance", entityId: created.id, summary: `${account.displayName} chấm công vào.` });
        return [created];
      });
      return reply.code(201).send({ record });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: { code: "ALREADY_CLOCKED_IN", message: "Bạn đang có ca chấm công mở." } });
      throw error;
    }
  });

  app.post("/attendance/clock-out", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const [record] = await db.transaction(async (tx) => {
      const [updated] = await tx.update(attendanceRecords).set({ clockOutAt: new Date() })
        .where(and(eq(attendanceRecords.employeeId, account.id), sql`${attendanceRecords.clockOutAt} IS NULL`))
        .returning({ id: attendanceRecords.id, clockInAt: attendanceRecords.clockInAt, clockOutAt: attendanceRecords.clockOutAt });
      if (updated) await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "clocked_out", entityType: "attendance", entityId: updated.id, summary: `${account.displayName} chấm công ra.` });
      return [updated];
    });
    if (!record) return reply.code(409).send({ error: { code: "NOT_CLOCKED_IN", message: "Bạn chưa chấm công vào." } });
    return { record };
  });
};
