import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { accounts, auditLogs, orderItems, orders, payments, shiftHandoverSheets } from "../db/schema.js";

async function reportForHandover(id: string) {
  const [[ordersSummary], [paymentsSummary]] = await Promise.all([
    db.select({
    invoiceCount: sql<number>`count(distinct case when ${orders.status} = 'completed' then ${orders.id} end)`.mapWith(Number),
    revenueVnd: sql<number>`coalesce(sum(${orders.totalVnd}) filter (where ${orders.status} = 'completed'), 0)`.mapWith(Number),
  }).from(orders).where(eq(orders.shiftHandoverId, id)),
    db.select({
    cashVnd: sql<number>`coalesce(sum(${payments.amountVnd}) filter (where ${payments.method} = 'cash' and ${payments.status} = 'completed'), 0)`.mapWith(Number),
    bankTransferVnd: sql<number>`coalesce(sum(${payments.amountVnd}) filter (where ${payments.method} = 'bank_transfer' and ${payments.status} = 'completed'), 0)`.mapWith(Number),
    creditVnd: sql<number>`coalesce(sum(${payments.amountVnd}) filter (where ${payments.method} = 'credit' and ${payments.status} = 'pending'), 0)`.mapWith(Number),
  }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(eq(orders.shiftHandoverId, id)),
  ]);
  const items = await db.select({
    name: orderItems.productNameSnapshot,
    quantity: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
    revenueVnd: sql<number>`sum(${orderItems.lineTotalVnd})`.mapWith(Number),
  }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.shiftHandoverId, id), eq(orders.status, "completed")))
    .groupBy(orderItems.productNameSnapshot).orderBy(sql`sum(${orderItems.quantity}) DESC`);
  return { ...ordersSummary, ...paymentsSummary, items };
}

export const shiftHandoverRoutes: FastifyPluginAsync = async (app) => {
  app.get("/shift-handovers", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const canViewAll = account.role === "owner" || account.role === "manager";
    const sheets = await db.select({
      id: shiftHandoverSheets.id, employeeId: shiftHandoverSheets.employeeId,
      employeeName: accounts.displayName, openedAt: shiftHandoverSheets.openedAt,
      closedAt: shiftHandoverSheets.closedAt, openingCashVnd: shiftHandoverSheets.openingCashVnd,
      closingCashVnd: shiftHandoverSheets.closingCashVnd, note: shiftHandoverSheets.note,
    }).from(shiftHandoverSheets).innerJoin(accounts, eq(accounts.id, shiftHandoverSheets.employeeId))
      .where(canViewAll ? undefined : eq(shiftHandoverSheets.employeeId, account.id))
      .orderBy(desc(shiftHandoverSheets.openedAt)).limit(100);
    const summaries = await Promise.all(sheets.map(async (sheet) => ({ ...sheet, ...(await reportForHandover(sheet.id)) })));
    return { handovers: summaries, current: summaries.find((sheet) => !sheet.closedAt) ?? null };
  });

  app.post<{ Body: { openingCashVnd: number; note?: string } }>("/shift-handovers", {
    schema: { body: { type: "object", additionalProperties: false, required: ["openingCashVnd"], properties: {
      openingCashVnd: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER }, note: { type: "string", maxLength: 500 },
    } } },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    try {
      const [sheet] = await db.transaction(async (tx) => {
        const [created] = await tx.insert(shiftHandoverSheets).values({
          employeeId: account.id, openedByAccountId: account.id, openingCashVnd: request.body.openingCashVnd,
          note: request.body.note?.trim() || null,
        }).returning({ id: shiftHandoverSheets.id, openedAt: shiftHandoverSheets.openedAt });
        await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "opened", entityType: "shift_handover", entityId: created.id, summary: `${account.displayName} bắt đầu ca.` });
        return [created];
      });
      return reply.code(201).send({ handover: sheet });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: { code: "HANDOVER_ALREADY_OPEN", message: "Bạn đã có phiếu giao ca đang mở." } });
      throw error;
    }
  });

  app.post<{ Params: { id: string }; Body: { closingCashVnd: number; note?: string } }>("/shift-handovers/:id/close", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["closingCashVnd"], properties: {
        closingCashVnd: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER }, note: { type: "string", maxLength: 500 },
      } },
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const canManage = account.role === "owner" || account.role === "manager";
    const [updated] = await db.transaction(async (tx) => {
      const [closed] = await tx.update(shiftHandoverSheets).set({
        closedAt: new Date(), closingCashVnd: request.body.closingCashVnd,
        closedByAccountId: account.id,
        ...(request.body.note?.trim() && { note: request.body.note.trim() }),
      }).where(and(eq(shiftHandoverSheets.id, request.params.id), sql`${shiftHandoverSheets.closedAt} IS NULL`, canManage ? undefined : eq(shiftHandoverSheets.employeeId, account.id)))
        .returning({ id: shiftHandoverSheets.id });
      if (closed) await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "closed", entityType: "shift_handover", entityId: closed.id, summary: `${account.displayName} chốt phiếu giao ca.` });
      return [closed];
    });
    if (!updated) return reply.code(404).send({ error: { code: "HANDOVER_NOT_OPEN", message: "Không tìm thấy phiếu đang mở hoặc bạn không có quyền đóng phiếu." } });
    return { handover: { id: updated.id, ...(await reportForHandover(updated.id)) } };
  });
};
