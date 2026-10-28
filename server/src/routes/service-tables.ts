import type { FastifyPluginAsync } from "fastify";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { auditLogs, orders, serviceTables } from "../db/schema.js";

type ServiceTableBody = { roomName: string; tableName: string };

export const serviceTableRoutes: FastifyPluginAsync = async (app) => {
  app.get("/service-tables", async (request, reply) => {
    if (!(await getSessionAccount(request))) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const [tables, occupiedRows] = await Promise.all([
      db.select({ id: serviceTables.id, roomName: serviceTables.roomName, tableName: serviceTables.tableName })
        .from(serviceTables).where(eq(serviceTables.isActive, true))
        .orderBy(asc(serviceTables.roomName), asc(serviceTables.tableName)),
      db.select({ id: orders.id, serviceLocation: orders.serviceLocation }).from(orders)
        .where(eq(orders.status, "awaiting_payment")).orderBy(desc(orders.orderedAt)),
    ]);
    const occupiedByLocation = new Map<string, string>();
    for (const row of occupiedRows) if (row.serviceLocation && !occupiedByLocation.has(row.serviceLocation)) occupiedByLocation.set(row.serviceLocation, row.id);
    return { tables: tables.map((table) => {
      const activeOrderId = occupiedByLocation.get(`${table.roomName} · ${table.tableName}`) ?? null;
      return { ...table, isOccupied: Boolean(activeOrderId), activeOrderId };
    }) };
  });

  app.post<{ Body: ServiceTableBody }>("/service-tables", {
    schema: { body: { type: "object", additionalProperties: false, required: ["roomName", "tableName"], properties: {
      roomName: { type: "string", minLength: 1, maxLength: 100 }, tableName: { type: "string", minLength: 1, maxLength: 100 },
    } } },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền thêm bàn." } });
    const roomName = request.body.roomName.trim();
    const tableName = request.body.tableName.trim();
    if (!roomName || !tableName) return reply.code(422).send({ error: { code: "INVALID_SERVICE_TABLE", message: "Nhập tên phòng và bàn." } });
    const [existing] = await db.select({ id: serviceTables.id }).from(serviceTables).where(and(
      eq(serviceTables.isActive, true),
      sql`lower(${serviceTables.roomName}) = lower(${roomName}) AND lower(${serviceTables.tableName}) = lower(${tableName})`,
    )).limit(1);
    if (existing) return reply.code(409).send({ error: { code: "SERVICE_TABLE_EXISTS", message: "Bàn này đã tồn tại trong phòng." } });
    const [created] = await db.insert(serviceTables).values({ roomName, tableName }).returning({ id: serviceTables.id, roomName: serviceTables.roomName, tableName: serviceTables.tableName });
    await db.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "created", entityType: "service_table", entityId: created.id, summary: `Thêm ${created.roomName} · ${created.tableName}.` });
    return reply.code(201).send({ table: created });
  });

  app.delete<{ Params: { id: string } }>("/service-tables/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền xóa bàn." } });
    const [removed] = await db.update(serviceTables).set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(serviceTables.id, request.params.id), eq(serviceTables.isActive, true)))
      .returning({ id: serviceTables.id, roomName: serviceTables.roomName, tableName: serviceTables.tableName });
    if (!removed) return reply.code(404).send({ error: { code: "SERVICE_TABLE_NOT_FOUND", message: "Không tìm thấy bàn." } });
    await db.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "deactivated", entityType: "service_table", entityId: removed.id, summary: `Ẩn ${removed.roomName} · ${removed.tableName}.` });
    return reply.code(204).send();
  });
};
