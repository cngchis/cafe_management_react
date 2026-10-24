import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { auditLogs, inventoryMovements, products, purchaseReceiptItems, purchaseReceipts } from "../db/schema.js";

type PurchaseBody = {
  supplierName?: string;
  note?: string;
  items: Array<{ productId: string; quantity: number; unitCostVnd: number }>;
};

export const purchaseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/purchases", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền xem phiếu nhập." } });
    const receipts = await db.select({
      id: purchaseReceipts.id, receiptNumber: purchaseReceipts.receiptNumber,
      supplierName: purchaseReceipts.supplierName, receivedAt: purchaseReceipts.receivedAt,
      totalVnd: purchaseReceipts.totalVnd, note: purchaseReceipts.note,
      itemCount: sql<number>`count(${purchaseReceiptItems.id})`.mapWith(Number),
    }).from(purchaseReceipts).leftJoin(purchaseReceiptItems, eq(purchaseReceiptItems.purchaseReceiptId, purchaseReceipts.id))
      .groupBy(purchaseReceipts.id).orderBy(desc(purchaseReceipts.receivedAt)).limit(100);
    return { receipts };
  });

  app.post<{ Body: PurchaseBody }>("/purchases", {
    schema: { body: { type: "object", additionalProperties: false, required: ["items"], properties: {
      supplierName: { type: "string", maxLength: 200 }, note: { type: "string", maxLength: 500 },
      items: { type: "array", minItems: 1, maxItems: 300, items: { type: "object", additionalProperties: false,
        required: ["productId", "quantity", "unitCostVnd"], properties: {
          productId: { type: "string", format: "uuid" }, quantity: { type: "number", exclusiveMinimum: 0, maximum: 10000000 },
          unitCostVnd: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
        } } },
    } } },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền nhập hàng." } });
    const ids = request.body.items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) return reply.code(422).send({ error: { code: "DUPLICATE_PRODUCT", message: "Mỗi món chỉ được có một dòng trong phiếu nhập." } });
    if (request.body.items.some((item) => Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) > 1e-7)) {
      return reply.code(422).send({ error: { code: "INVALID_QUANTITY_PRECISION", message: "Số lượng chỉ được có tối đa 3 chữ số thập phân." } });
    }

    const receipt = await db.transaction(async (tx) => {
      const lockedProducts = await tx.select({ id: products.id, name: products.name, isActive: products.isActive })
        .from(products).where(inArray(products.id, ids)).orderBy(products.id).for("update");
      if (lockedProducts.length !== ids.length || lockedProducts.some((product) => !product.isActive)) {
        throw Object.assign(new Error("Một hoặc nhiều món không còn hoạt động."), { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
      }
      const productsById = new Map(lockedProducts.map((product) => [product.id, product]));
      const lines = request.body.items.map((item) => {
        const quantityMilli = BigInt(Math.round(item.quantity * 1000));
        const rawLineTotal = (quantityMilli * BigInt(item.unitCostVnd) + 500n) / 1000n;
        if (rawLineTotal > BigInt(Number.MAX_SAFE_INTEGER)) throw Object.assign(new Error("Giá trị phiếu nhập vượt giới hạn."), { statusCode: 422, code: "AMOUNT_TOO_LARGE" });
        return { ...item, productNameSnapshot: productsById.get(item.productId)!.name, lineTotalVnd: Number(rawLineTotal) };
      });
      const totalBigInt = lines.reduce((sum, item) => sum + BigInt(item.lineTotalVnd), 0n);
      if (totalBigInt > BigInt(Number.MAX_SAFE_INTEGER)) throw Object.assign(new Error("Tổng phiếu nhập vượt giới hạn."), { statusCode: 422, code: "AMOUNT_TOO_LARGE" });
      const receiptNumber = `NH${Date.now()}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const [created] = await tx.insert(purchaseReceipts).values({
        receiptNumber, supplierName: request.body.supplierName?.trim() || null,
        totalVnd: Number(totalBigInt), note: request.body.note?.trim() || null, createdByAccountId: account.id,
      }).returning({ id: purchaseReceipts.id, receiptNumber: purchaseReceipts.receiptNumber, totalVnd: purchaseReceipts.totalVnd, receivedAt: purchaseReceipts.receivedAt });
      const items = await tx.insert(purchaseReceiptItems).values(lines.map((line) => ({
        purchaseReceiptId: created.id, productId: line.productId, productNameSnapshot: line.productNameSnapshot,
        quantity: Math.round(line.quantity * 1000) / 1000, unitCostVnd: line.unitCostVnd, lineTotalVnd: line.lineTotalVnd,
      }))).returning({ id: purchaseReceiptItems.id, productId: purchaseReceiptItems.productId, quantity: purchaseReceiptItems.quantity, unitCostVnd: purchaseReceiptItems.unitCostVnd });
      await tx.insert(inventoryMovements).values(items.map((item) => ({
        productId: item.productId, quantityDelta: item.quantity, reason: "purchase_receipt" as const,
        purchaseReceiptItemId: item.id, note: `Nhập hàng ${created.receiptNumber}`, createdByName: account.displayName,
      })));
      for (const item of items) await tx.update(products).set({ costPriceVnd: item.unitCostVnd, updatedAt: new Date() }).where(eq(products.id, item.productId));
      await tx.insert(auditLogs).values({
        accountId: account.id, actorName: account.displayName, action: "created", entityType: "purchase_receipt",
        entityId: created.id, summary: `Tạo phiếu nhập ${created.receiptNumber} gồm ${items.length} mặt hàng.`,
      });
      return { ...created, itemCount: items.length };
    });
    return reply.code(201).send({ receipt });
  });
};
