import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import {
  cashbookEntries,
  inventoryCheckItems,
  inventoryChecks,
  inventoryMovements,
  orderItems,
  orders,
  payments,
  products,
  workShifts,
} from "../db/schema.js";

async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  const account = await getSessionAccount(request);
  if (!account) {
    reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    return false;
  }
  if (account.role !== "owner") {
    reply.code(403).send({ error: { code: "FORBIDDEN", message: "Chỉ chủ cửa hàng được xóa dữ liệu." } });
    return false;
  }
  return true;
}

export const dataResetRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { confirmation: string } }>("/admin/data-reset", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["confirmation"],
        properties: { confirmation: { type: "string", const: "XÓA DỮ LIỆU" } },
      },
    },
  }, async (request, reply) => {
    if (!(await requireOwner(request, reply))) return;
    if (request.body.confirmation !== "XÓA DỮ LIỆU") {
      return reply.code(422).send({ error: { code: "CONFIRMATION_REQUIRED", message: "Cụm từ xác nhận không chính xác." } });
    }

    await db.transaction(async (tx) => {
      await tx.delete(cashbookEntries);
      await tx.delete(payments);
      await tx.delete(orderItems);
      await tx.delete(inventoryCheckItems);
      await tx.delete(inventoryChecks);
      await tx.delete(inventoryMovements);
      await tx.execute(sql`DELETE FROM customers`);
      await tx.delete(orders);
      await tx.delete(workShifts);
      await tx.delete(products);
    });

    return { success: true };
  });
};
