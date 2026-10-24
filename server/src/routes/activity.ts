import type { FastifyPluginAsync } from "fastify";
import { desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { auditLogs } from "../db/schema.js";

export const activityRoutes: FastifyPluginAsync = async (app) => {
  app.get("/activity", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền xem lịch sử thao tác." } });
    const events = await db.select({
      id: auditLogs.id, actorName: auditLogs.actorName, action: auditLogs.action,
      entityType: auditLogs.entityType, entityId: auditLogs.entityId,
      summary: auditLogs.summary, occurredAt: auditLogs.occurredAt,
    }).from(auditLogs).orderBy(desc(auditLogs.occurredAt)).limit(300);
    return { events };
  });
};
