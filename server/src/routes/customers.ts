import type { FastifyPluginAsync } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { auditLogs, customers } from "../db/schema.js";

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/customers", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const rows = await db.select({
      id: customers.id, name: customers.name, phone: customers.phone,
      points: customers.pointsBalance, tier: customers.membershipTier,
    }).from(customers).where(eq(customers.isActive, true)).orderBy(asc(customers.name)).limit(1000);
    return { customers: rows };
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
