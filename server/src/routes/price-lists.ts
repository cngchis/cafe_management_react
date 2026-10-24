import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { auditLogs, customers, priceListCustomers, priceListItems, priceLists, products } from "../db/schema.js";

type PriceListBody = {
  name: string; startsAt: string; endsAt?: string; appliesToAllCustomers: boolean;
  customerIds?: string[]; items: Array<{ productId: string; salePriceVnd: number }>;
};

export const priceListRoutes: FastifyPluginAsync = async (app) => {
  app.get("/price-lists", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền xem bảng giá." } });
    const lists = await db.select({
      id: priceLists.id, name: priceLists.name, startsAt: priceLists.startsAt, endsAt: priceLists.endsAt,
      appliesToAllCustomers: priceLists.appliesToAllCustomers, isActive: priceLists.isActive,
      customerCount: sql<number>`count(distinct ${priceListCustomers.customerId})`.mapWith(Number),
      productCount: sql<number>`count(distinct ${priceListItems.productId})`.mapWith(Number),
    }).from(priceLists).leftJoin(priceListCustomers, eq(priceListCustomers.priceListId, priceLists.id))
      .leftJoin(priceListItems, eq(priceListItems.priceListId, priceLists.id))
      .groupBy(priceLists.id).orderBy(desc(priceLists.startsAt));
    return { lists };
  });

  app.get("/price-lists/targets", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const [productRows, customerRows] = await Promise.all([
      db.select({ id: products.id, name: products.name, category: products.category, price: products.salePriceVnd })
        .from(products).where(eq(products.isActive, true)).orderBy(products.name),
      db.select({ id: customers.id, name: customers.name, phone: customers.phone })
        .from(customers).where(eq(customers.isActive, true)).orderBy(customers.name).limit(500),
    ]);
    return { products: productRows, customers: customerRows };
  });

  app.post<{ Body: PriceListBody }>("/price-lists", {
    schema: { body: { type: "object", additionalProperties: false, required: ["name", "startsAt", "appliesToAllCustomers", "items"], properties: {
      name: { type: "string", minLength: 1, maxLength: 200 }, startsAt: { type: "string", format: "date-time" },
      endsAt: { type: "string", format: "date-time" }, appliesToAllCustomers: { type: "boolean" },
      customerIds: { type: "array", maxItems: 500, items: { type: "string", format: "uuid" } },
      items: { type: "array", minItems: 1, maxItems: 500, items: { type: "object", additionalProperties: false,
        required: ["productId", "salePriceVnd"], properties: { productId: { type: "string", format: "uuid" }, salePriceVnd: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER } } } },
    } } },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền tạo bảng giá." } });
    const body = request.body;
    const customerIds = body.customerIds ?? [];
    const productIds = body.items.map((item) => item.productId);
    if (!body.name.trim() || (body.endsAt && new Date(body.endsAt) <= new Date(body.startsAt))) {
      return reply.code(422).send({ error: { code: "INVALID_PRICE_LIST", message: "Tên và thời gian áp dụng bảng giá không hợp lệ." } });
    }
    if ((!body.appliesToAllCustomers && customerIds.length === 0) || new Set(customerIds).size !== customerIds.length || new Set(productIds).size !== productIds.length) {
      return reply.code(422).send({ error: { code: "INVALID_PRICE_LIST_SCOPE", message: "Chọn ít nhất một khách hàng hoặc tránh mục bị trùng." } });
    }
    const [created] = await db.transaction(async (tx) => {
      const [productCount, customerCount] = await Promise.all([
        tx.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(products).where(inArray(products.id, productIds)),
        customerIds.length ? tx.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(customers).where(inArray(customers.id, customerIds)) : Promise.resolve([{ count: 0 }]),
      ]);
      if (productCount[0].count !== productIds.length || (!body.appliesToAllCustomers && customerCount[0].count !== customerIds.length)) {
        throw Object.assign(new Error("Sản phẩm hoặc khách hàng không còn khả dụng."), { statusCode: 409, code: "PRICE_LIST_TARGET_UNAVAILABLE" });
      }
      const [list] = await tx.insert(priceLists).values({
        name: body.name.trim(), startsAt: new Date(body.startsAt), endsAt: body.endsAt ? new Date(body.endsAt) : null,
        appliesToAllCustomers: body.appliesToAllCustomers, createdByAccountId: account.id,
      }).returning({ id: priceLists.id, name: priceLists.name });
      if (!body.appliesToAllCustomers) await tx.insert(priceListCustomers).values(customerIds.map((customerId) => ({ priceListId: list.id, customerId })));
      await tx.insert(priceListItems).values(body.items.map((item) => ({ ...item, priceListId: list.id })));
      await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "created", entityType: "price_list", entityId: list.id, summary: `Tạo bảng giá ${list.name}.` });
      return [list];
    });
    return reply.code(201).send({ list: created });
  });

  app.post<{ Params: { id: string } }>("/price-lists/:id/deactivate", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền sửa bảng giá." } });
    const [list] = await db.update(priceLists).set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(priceLists.id, request.params.id), eq(priceLists.isActive, true))).returning({ id: priceLists.id, name: priceLists.name });
    if (!list) return reply.code(404).send({ error: { code: "PRICE_LIST_NOT_FOUND", message: "Không tìm thấy bảng giá đang áp dụng." } });
    await db.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "deactivated", entityType: "price_list", entityId: list.id, summary: `Ngừng áp dụng bảng giá ${list.name}.` });
    return { list };
  });
};
