import type { FastifyPluginAsync } from "fastify";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { inventoryCheckItems, inventoryChecks, inventoryMovements, products } from "../db/schema.js";

type CheckBody = {
  note?: string;
  items: Array<{ productId: string; countedQuantity: number }>;
};

export const inventoryCheckRoutes: FastifyPluginAsync = async (app) => {
  app.get("/inventory/checks", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền xem kiểm kho." } });

    const rows = await db.select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      image: products.imageUrl,
      stock: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`.mapWith(Number),
    }).from(products).leftJoin(inventoryMovements, eq(inventoryMovements.productId, products.id))
      .where(eq(products.isActive, true)).groupBy(products.id).orderBy(products.name);
    const history = await db.select({
      id: inventoryChecks.id,
      note: inventoryChecks.note,
      checkedByName: inventoryChecks.checkedByName,
      createdAt: inventoryChecks.createdAt,
      itemCount: sql<number>`count(${inventoryCheckItems.id})`.mapWith(Number),
      changedItemCount: sql<number>`count(*) filter (where ${inventoryCheckItems.deltaQuantity} <> 0)`.mapWith(Number),
      netDelta: sql<number>`coalesce(sum(${inventoryCheckItems.deltaQuantity}), 0)`.mapWith(Number),
    }).from(inventoryChecks).leftJoin(inventoryCheckItems, eq(inventoryCheckItems.checkId, inventoryChecks.id))
      .groupBy(inventoryChecks.id).orderBy(desc(inventoryChecks.createdAt)).limit(20);

    return { products: rows, history };
  });

  app.post<{ Body: CheckBody }>("/inventory/checks", {
    schema: {
      body: {
        type: "object", additionalProperties: false, required: ["items"],
        properties: {
          note: { type: "string", maxLength: 500 },
          items: {
            type: "array", minItems: 1, maxItems: 1000,
            items: {
              type: "object", additionalProperties: false, required: ["productId", "countedQuantity"],
              properties: {
                productId: { type: "string", format: "uuid" },
                countedQuantity: { type: "number", minimum: 0, maximum: 1000000000 },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền kiểm kho." } });

    const submittedIds = request.body.items.map((item) => item.productId);
    if (new Set(submittedIds).size !== submittedIds.length) {
      return reply.code(422).send({ error: { code: "DUPLICATE_PRODUCT", message: "Danh sách kiểm kho có món bị lặp." } });
    }
    if (request.body.items.some(({ countedQuantity }) => Math.abs(countedQuantity * 1000 - Math.round(countedQuantity * 1000)) > 1e-7)) {
      return reply.code(422).send({ error: { code: "INVALID_QUANTITY_PRECISION", message: "Số lượng kiểm kho chỉ được có tối đa 3 chữ số thập phân." } });
    }

    const result = await db.transaction(async (tx) => {
      const ids = [...submittedIds].sort();
      const lockedProducts = await tx.select({ id: products.id, name: products.name, isActive: products.isActive })
        .from(products).where(inArray(products.id, ids)).orderBy(products.id).for("update");
      if (lockedProducts.length !== ids.length || lockedProducts.some((product) => !product.isActive)) {
        throw Object.assign(new Error("Một hoặc nhiều món không còn khả dụng."), { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
      }

      const currentRows = await tx.select({
        productId: inventoryMovements.productId,
        stock: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`.mapWith(Number),
      }).from(inventoryMovements).where(inArray(inventoryMovements.productId, ids)).groupBy(inventoryMovements.productId);
      const currentById = new Map(currentRows.map((row) => [row.productId, row.stock]));
      const productsById = new Map(lockedProducts.map((product) => [product.id, product]));
      const checkItems = request.body.items.map((item) => {
        const expected = currentById.get(item.productId) ?? 0;
        const expectedMilli = Math.round(expected * 1000);
        const countedMilli = Math.round(item.countedQuantity * 1000);
        const delta = (countedMilli - expectedMilli) / 1000;
        return {
          productId: item.productId,
          productNameSnapshot: productsById.get(item.productId)!.name,
          expectedQuantity: expectedMilli / 1000,
          countedQuantity: countedMilli / 1000,
          deltaQuantity: delta,
        };
      });

      const [check] = await tx.insert(inventoryChecks).values({
        checkedByName: account.displayName,
        note: request.body.note?.trim() || null,
      }).returning({ id: inventoryChecks.id });
      await tx.insert(inventoryCheckItems).values(checkItems.map((item) => ({ ...item, checkId: check.id })));
      const movements = checkItems.filter((item) => item.deltaQuantity !== 0).map((item) => ({
        productId: item.productId,
        quantityDelta: item.deltaQuantity,
        reason: "correction" as const,
        note: `Kiểm kho ${check.id}${request.body.note?.trim() ? `: ${request.body.note.trim()}` : ""}`,
        createdByName: account.displayName,
      }));
      if (movements.length) await tx.insert(inventoryMovements).values(movements);
      return { id: check.id, itemCount: checkItems.length, changedItemCount: movements.length };
    });

    return reply.code(201).send({ check: result });
  });
};
