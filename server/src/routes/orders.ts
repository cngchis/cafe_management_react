import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { cashAccounts, cashbookEntries, inventoryMovements, orderItems, orders, payments, products } from "../db/schema.js";

const bodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "orderType"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["productId", "quantity"],
        properties: {
          productId: { type: "string", format: "uuid" },
          quantity: { type: "integer", minimum: 1, maximum: 1000 },
        },
      },
    },
    orderType: { type: "string", enum: ["dine_in", "takeaway", "delivery"] },
    note: { type: "string", maxLength: 2000 },
  },
} as const;

type CreateOrderBody = {
  items: Array<{ productId: string; quantity: number }>;
  orderType: "dine_in" | "takeaway" | "delivery";
  note?: string;
};

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get("/orders", async (request, reply) => {
    if (!(await getSessionAccount(request))) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    }

    const rows = await db.select({
      id: orders.id,
      receiptCode: orders.receiptCode,
      orderNumber: orders.orderNumber,
      orderType: orders.orderType,
      serviceLocation: orders.serviceLocation,
      guestCount: orders.guestCount,
      cashierName: orders.cashierName,
      subtotalVnd: orders.subtotalVnd,
      discountVnd: orders.discountVnd,
      serviceFeeVnd: orders.serviceFeeVnd,
      totalVnd: orders.totalVnd,
      status: orders.status,
      orderedAt: orders.orderedAt,
      paymentMethod: sql<string | null>`min(${payments.method})`,
      paidAmountVnd: sql<number>`coalesce(sum(case when ${payments.status} = 'completed' then ${payments.amountVnd} else 0 end), 0)`.mapWith(Number),
    }).from(orders)
      .leftJoin(payments, eq(payments.orderId, orders.id))
      .where(inArray(orders.status, ["completed", "cancelled"]))
      .groupBy(orders.id)
      .orderBy(desc(orders.orderedAt))
      .limit(100);

    return { orders: rows };
  });

  app.get<{ Params: { id: string } }>("/orders/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!(await getSessionAccount(request))) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    }

    const [order] = await db.select({
      id: orders.id,
      receiptCode: orders.receiptCode,
      orderNumber: orders.orderNumber,
      orderType: orders.orderType,
      serviceLocation: orders.serviceLocation,
      guestCount: orders.guestCount,
      cashierName: orders.cashierName,
      subtotalVnd: orders.subtotalVnd,
      discountVnd: orders.discountVnd,
      serviceFeeVnd: orders.serviceFeeVnd,
      totalVnd: orders.totalVnd,
      status: orders.status,
      orderedAt: orders.orderedAt,
    }).from(orders).where(eq(orders.id, request.params.id)).limit(1);
    if (!order) return reply.code(404).send({ error: { code: "ORDER_NOT_FOUND", message: "Không tìm thấy hóa đơn." } });

    const items = await db.select({
      name: orderItems.productNameSnapshot,
      portion: orderItems.portionSnapshot,
      note: orderItems.note,
      quantity: orderItems.quantity,
      unitPriceVnd: orderItems.unitPriceVnd,
      lineTotalVnd: orderItems.lineTotalVnd,
    }).from(orderItems).where(eq(orderItems.orderId, order.id));
    const paymentRows = await db.select({
      method: payments.method,
      amountVnd: payments.amountVnd,
      status: payments.status,
    }).from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.paidAt));

    return { order: {
      ...order,
      paymentMethod: paymentRows[0]?.method ?? null,
      paidAmountVnd: paymentRows.reduce((sum, payment) => sum + (payment.status === "completed" ? payment.amountVnd : 0), 0),
      items,
    } };
  });

  app.post<{ Params: { id: string } }>("/orders/:id/cancel", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền hủy hóa đơn." } });

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
      }).from(orders).where(eq(orders.id, request.params.id)).for("update").limit(1);
      if (!order) throw Object.assign(new Error("Không tìm thấy hóa đơn."), { statusCode: 404, code: "ORDER_NOT_FOUND" });
      if (order.status !== "completed") throw Object.assign(new Error("Chỉ có thể hủy hóa đơn đã hoàn thành."), { statusCode: 409, code: "ORDER_NOT_CANCELLABLE" });

      const completedPayments = await tx.select({ id: payments.id, amountVnd: payments.amountVnd })
        .from(payments).where(and(eq(payments.orderId, order.id), eq(payments.status, "completed"))).for("update");
      const refunds: Array<{ cashAccountId: string; amountVnd: number }> = [];
      for (const payment of completedPayments) {
        const [cashEntry] = await tx.select({ cashAccountId: cashbookEntries.cashAccountId })
          .from(cashbookEntries).where(eq(cashbookEntries.paymentId, payment.id)).limit(1);
        if (!cashEntry) throw Object.assign(new Error("Không tìm thấy giao dịch thu tiền để đối soát hủy hóa đơn."), { statusCode: 409, code: "PAYMENT_LEDGER_MISSING" });
        refunds.push({ cashAccountId: cashEntry.cashAccountId, amountVnd: payment.amountVnd });
      }

      const soldItems = await tx.select({ productId: orderItems.productId, quantity: orderItems.quantity })
        .from(orderItems).where(eq(orderItems.orderId, order.id));
      const now = new Date();

      for (const refund of refunds) {
        await tx.insert(cashbookEntries).values({
          cashAccountId: refund.cashAccountId,
          referenceCode: `HT${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          direction: "out",
          title: "Hoàn tiền hủy hóa đơn",
          category: "Hoàn tiền bán hàng",
          counterpartyGroup: "Khách hàng",
          counterpartyName: "Khách hàng",
          description: `Hoàn tiền hóa đơn ${order.orderNumber}`,
          amountVnd: refund.amountVnd,
          createdByName: account.displayName,
          occurredAt: now,
        });
      }

      if (completedPayments.length) {
        await tx.update(payments).set({ status: "refunded" })
          .where(and(eq(payments.orderId, order.id), eq(payments.status, "completed")));
      }
      const restockItems = soldItems.filter((item): item is { productId: string; quantity: number } => item.productId !== null);
      if (restockItems.length) {
        await tx.insert(inventoryMovements).values(restockItems.map((item) => ({
          productId: item.productId,
          quantityDelta: item.quantity,
          reason: "sale_cancellation" as const,
          note: `Nhập lại hàng do hủy hóa đơn ${order.orderNumber}`,
          createdByName: account.displayName,
          occurredAt: now,
        })));
      }

      await tx.update(orders).set({ status: "cancelled", updatedAt: now }).where(eq(orders.id, order.id));
      return { id: order.id, status: "cancelled" as const };
    });

    return { order: result };
  });

  app.post<{ Body: CreateOrderBody; Headers: { "idempotency-key"?: string } }>("/orders", {
    schema: {
      headers: {
        type: "object",
        properties: { "idempotency-key": { type: "string", format: "uuid" } },
      },
      body: bodySchema,
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const idempotencyKey = request.headers["idempotency-key"];
    if (!idempotencyKey) return reply.code(400).send({ error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Thiếu mã yêu cầu đơn hàng." } });

    const quantities = new Map<string, number>();
    for (const item of request.body.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    if ([...quantities.values()].some((quantity) => quantity > 1000)) {
      return reply.code(422).send({ error: { code: "QUANTITY_LIMIT", message: "Số lượng mỗi món tối đa là 1000." } });
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`);
      const [existingOrder] = await tx.select({ id: orders.id, orderNumber: orders.orderNumber, totalVnd: orders.totalVnd })
        .from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).limit(1);
      if (existingOrder) return existingOrder;

      const ids = [...quantities.keys()].sort();
      const lockedProducts = await tx.select({
        id: products.id,
        name: products.name,
        price: products.salePriceVnd,
        isActive: products.isActive,
      }).from(products).where(inArray(products.id, ids)).orderBy(products.id).for("update");
      if (lockedProducts.length !== ids.length || lockedProducts.some((product) => !product.isActive)) {
        throw Object.assign(new Error("Một hoặc nhiều món không còn khả dụng."), { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
      }

      const stockRows = await tx.select({
        productId: inventoryMovements.productId,
        stock: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`.mapWith(Number),
      }).from(inventoryMovements).where(inArray(inventoryMovements.productId, ids)).groupBy(inventoryMovements.productId);
      const stockByProduct = new Map(stockRows.map((row) => [row.productId, row.stock]));
      for (const [productId, quantity] of quantities) {
        if ((stockByProduct.get(productId) ?? 0) < quantity) {
          throw Object.assign(new Error("Tồn kho không đủ cho một hoặc nhiều món."), { statusCode: 409, code: "INSUFFICIENT_STOCK" });
        }
      }

      const byId = new Map(lockedProducts.map((product) => [product.id, product]));
      const lineItems = ids.map((productId) => {
        const product = byId.get(productId)!;
        const quantity = quantities.get(productId)!;
        if (!Number.isSafeInteger(product.price) || !Number.isSafeInteger(product.price * quantity)) {
          throw Object.assign(new Error("Giá món vượt quá giới hạn hỗ trợ."), { statusCode: 422, code: "INVALID_PRODUCT_PRICE" });
        }
        return { productId, productNameSnapshot: product.name, quantity, unitPriceVnd: product.price,
          discountVnd: 0, lineTotalVnd: product.price * quantity };
      });
      const subtotal = lineItems.reduce((sum, item) => sum + BigInt(item.lineTotalVnd), 0n);
      const serviceFee = (subtotal * 5n + 50n) / 100n;
      const total = subtotal + serviceFee;
      if (total <= 0n || total > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw Object.assign(new Error("Tổng tiền đơn hàng không hợp lệ."), { statusCode: 422, code: "INVALID_ORDER_TOTAL" });
      }
      const orderNumber = `HD${Date.now()}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const [created] = await tx.insert(orders).values({
        idempotencyKey,
        receiptCode: orderNumber,
        orderNumber,
        status: "completed",
        orderType: request.body.orderType,
        serviceLocation: request.body.orderType === "dine_in" ? "Bàn 06" : request.body.orderType === "delivery" ? "Giao hàng" : "Mang đi",
        cashierName: account.displayName,
        orderNote: request.body.note?.trim() || null,
        subtotalVnd: Number(subtotal),
        discountVnd: 0,
        serviceFeePercent: 5,
        serviceFeeVnd: Number(serviceFee),
        totalVnd: Number(total),
        closedAt: new Date(),
      }).returning({ id: orders.id, orderNumber: orders.orderNumber, totalVnd: orders.totalVnd });

      await tx.insert(orderItems).values(lineItems.map((item) => ({ ...item, orderId: created.id })));
      const [payment] = await tx.insert(payments).values({ orderId: created.id, amountVnd: Number(total), method: "cash", status: "completed" }).returning({ id: payments.id });
      await tx.insert(cashAccounts).values({ name: "Tiền mặt", accountType: "cash" }).onConflictDoNothing();
      const [cashAccount] = await tx.select({ id: cashAccounts.id }).from(cashAccounts)
        .where(eq(cashAccounts.name, "Tiền mặt")).limit(1);
      await tx.insert(cashbookEntries).values({
        cashAccountId: cashAccount.id,
        paymentId: payment.id,
        referenceCode: `TH${orderNumber}`,
        direction: "in",
        title: "Thu tiền khách trả",
        category: "Thu tiền bán hàng",
        counterpartyGroup: "Khách hàng",
        counterpartyName: "Khách hàng",
        description: `Phiếu thu tự động cho hóa đơn ${orderNumber}`,
        amountVnd: Number(total),
        createdByName: account.displayName,
      });
      await tx.insert(inventoryMovements).values(lineItems.map((item) => ({
        productId: item.productId,
        quantityDelta: -item.quantity,
        reason: "sale" as const,
        note: `Bán hàng ${orderNumber}`,
        createdByName: account.displayName,
      })));

      return { ...created, paymentId: payment.id };
    });

    return reply.code(201).send({ order: result });
  });
};
