import type { FastifyPluginAsync } from "fastify";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { auditLogs, customers, orders, payments } from "../db/schema.js";

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/customers", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const rows = await db.select({
      id: customers.id, name: customers.name, phone: customers.phone,
      points: customers.pointsBalance, tier: customers.membershipTier,
      creditVnd: sql<number>`coalesce(sum(${payments.amountVnd}) filter (where ${payments.method} = 'credit' and ${payments.status} = 'pending'), 0)`.mapWith(Number),
    }).from(customers)
      .leftJoin(orders, and(eq(orders.customerId, customers.id), eq(orders.status, "completed")))
      .leftJoin(payments, eq(payments.orderId, orders.id))
      .where(eq(customers.isActive, true)).groupBy(customers.id).orderBy(asc(customers.name)).limit(1000);
    return { customers: rows };
  });

  app.get<{ Params: { id: string } }>("/customers/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const [customer] = await db.select({
      id: customers.id, name: customers.name, phone: customers.phone,
      points: customers.pointsBalance, tier: customers.membershipTier,
      creditVnd: sql<number>`coalesce(sum(${payments.amountVnd}) filter (where ${payments.method} = 'credit' and ${payments.status} = 'pending'), 0)`.mapWith(Number),
    }).from(customers)
      .leftJoin(orders, and(eq(orders.customerId, customers.id), eq(orders.status, "completed")))
      .leftJoin(payments, eq(payments.orderId, orders.id))
      .where(eq(customers.id, request.params.id)).groupBy(customers.id).limit(1);
    if (!customer) return reply.code(404).send({ error: { code: "CUSTOMER_NOT_FOUND", message: "Không tìm thấy khách hàng." } });

    const invoices = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      receiptCode: orders.receiptCode,
      orderType: orders.orderType,
      status: orders.status,
      orderedAt: orders.orderedAt,
      totalVnd: orders.totalVnd,
      paidVnd: sql<number>`coalesce(sum(${payments.amountVnd}) filter (where ${payments.status} = 'completed'), 0)`.mapWith(Number),
      creditVnd: sql<number>`coalesce(sum(${payments.amountVnd}) filter (where ${payments.method} = 'credit' and ${payments.status} = 'pending'), 0)`.mapWith(Number),
      paymentMethods: sql<string[]>`coalesce(array_agg(distinct ${payments.method}) filter (where ${payments.method} is not null), ARRAY[]::text[])`,
    }).from(orders).leftJoin(payments, eq(payments.orderId, orders.id))
      .where(and(eq(orders.customerId, customer.id), inArray(orders.status, ["completed", "awaiting_payment", "cancelled"])))
      .groupBy(orders.id).orderBy(desc(orders.orderedAt));
    return { customer, invoices };
  });

  app.post<{ Body: { name: string; phone?: string } }>("/customers", {
    schema: { body: { type: "object", additionalProperties: false, required: ["name"], properties: {
      name: { type: "string", minLength: 1, maxLength: 200 }, phone: { type: "string", maxLength: 32 },
    } } },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const name = request.body.name.trim();
    const phone = request.body.phone?.trim() || null;
    if (!name) return reply.code(400).send({ error: { code: "INVALID_CUSTOMER", message: "Tên khách hàng không được để trống." } });
    try {
      const [customer] = await db.transaction(async (tx) => {
        const [created] = await tx.insert(customers).values({ name, phone }).returning({ id: customers.id, name: customers.name, phone: customers.phone, points: customers.pointsBalance, tier: customers.membershipTier });
        await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "created", entityType: "customer", entityId: created.id, summary: `Tạo khách hàng ${created.name}` });
        return [created];
      });
      return reply.code(201).send({ customer });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: { code: "CUSTOMER_PHONE_EXISTS", message: "Số điện thoại này đã được sử dụng." } });
      throw error;
    }
  });
};
