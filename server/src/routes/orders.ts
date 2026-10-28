import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { auditLogs, cashAccounts, cashbookEntries, customers, inventoryMovements, orderItems, orders, payments, priceListCustomers, priceListItems, priceLists, products, shiftHandoverSheets } from "../db/schema.js";

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
    mode: { type: "string", enum: ["payment", "estimate"] },
    note: { type: "string", maxLength: 2000 },
    amountReceivedVnd: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    paymentMethod: { type: "string", enum: ["cash", "bank_transfer"] },
    customerName: { type: "string", maxLength: 200 },
    customerId: { type: "string", format: "uuid" },
    discountVnd: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    transferReference: { type: "string", minLength: 4, maxLength: 30 },
    bankAccountId: { type: "string", format: "uuid" },
  },
} as const;

type CreateOrderBody = {
  items: Array<{ productId: string; quantity: number }>;
  orderType: "dine_in" | "takeaway" | "delivery";
  mode?: "payment" | "estimate";
  note?: string;
  amountReceivedVnd?: number;
  paymentMethod?: "cash" | "bank_transfer";
  customerName?: string;
  customerId?: string;
  discountVnd?: number;
  transferReference?: string;
  bankAccountId?: string;
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
      .where(inArray(orders.status, ["awaiting_payment", "completed", "cancelled"]))
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
      productId: orderItems.productId,
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

  app.post<{ Params: { id: string }; Body: { amountReceivedVnd?: number; paymentMethod?: "cash" | "bank_transfer"; transferReference?: string; bankAccountId?: string }; Headers: { "idempotency-key"?: string } }>("/orders/:id/pay", {
    schema: {
      headers: { type: "object", properties: { "idempotency-key": { type: "string", format: "uuid" } } },
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object", additionalProperties: false,
        properties: {
          amountReceivedVnd: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
          paymentMethod: { type: "string", enum: ["cash", "bank_transfer"] },
          transferReference: { type: "string", minLength: 4, maxLength: 30 },
          bankAccountId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const idempotencyKey = request.headers["idempotency-key"];
    if (!idempotencyKey) return reply.code(400).send({ error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Thiếu mã yêu cầu thanh toán." } });

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, totalVnd: orders.totalVnd })
        .from(orders).where(eq(orders.id, request.params.id)).for("update").limit(1);
      if (!order) throw Object.assign(new Error("Không tìm thấy đơn tạm tính."), { statusCode: 404, code: "ORDER_NOT_FOUND" });
      if (order.status === "completed") return { orderNumber: order.orderNumber };
      if (order.status !== "awaiting_payment") throw Object.assign(new Error("Đơn này không ở trạng thái chờ thanh toán."), { statusCode: 409, code: "ORDER_NOT_PAYABLE" });

      const paymentMethod = request.body.paymentMethod ?? "cash";
      const tendered = request.body.amountReceivedVnd ?? order.totalVnd;
      if (!Number.isSafeInteger(tendered) || tendered < order.totalVnd) {
        throw Object.assign(new Error("Số tiền nhận phải bằng hoặc lớn hơn số tiền đơn hàng."), { statusCode: 422, code: "INVALID_TENDER" });
      }
      let cashAccountId: string;
      if (paymentMethod === "bank_transfer") {
        if (order.totalVnd <= 0 || tendered !== order.totalVnd || !request.body.transferReference?.trim() || !request.body.bankAccountId) {
          throw Object.assign(new Error("Chuyển khoản cần thanh toán đúng số tiền trên QR."), { statusCode: 422, code: "INVALID_BANK_TRANSFER_QR" });
        }
        const [bankAccount] = await tx.select({ id: cashAccounts.id }).from(cashAccounts)
          .where(and(eq(cashAccounts.id, request.body.bankAccountId), eq(cashAccounts.accountType, "bank"), eq(cashAccounts.isActive, true))).limit(1);
        if (!bankAccount) throw Object.assign(new Error("Tài khoản ngân hàng nhận tiền không còn hoạt động."), { statusCode: 409, code: "BANK_ACCOUNT_NOT_CONFIGURED" });
        cashAccountId = bankAccount.id;
      } else {
        await tx.insert(cashAccounts).values({ name: "Tiền mặt", accountType: "cash" }).onConflictDoNothing();
        const [cashAccount] = await tx.select({ id: cashAccounts.id }).from(cashAccounts).where(eq(cashAccounts.name, "Tiền mặt")).limit(1);
        cashAccountId = cashAccount.id;
      }

      const soldItems = await tx.select({ productId: orderItems.productId, quantity: orderItems.quantity })
        .from(orderItems).where(eq(orderItems.orderId, order.id));
      const productIds = [...new Set(soldItems.flatMap((item) => item.productId ? [item.productId] : []))].sort();
      const lockedProducts = productIds.length ? await tx.select({ id: products.id, isActive: products.isActive })
        .from(products).where(inArray(products.id, productIds)).orderBy(products.id).for("update") : [];
      if (lockedProducts.length !== productIds.length || lockedProducts.some((product) => !product.isActive)) {
        throw Object.assign(new Error("Một hoặc nhiều món trong đơn không còn khả dụng."), { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
      }
      const stockRows = productIds.length ? await tx.select({
        productId: inventoryMovements.productId,
        stock: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`.mapWith(Number),
      }).from(inventoryMovements).where(inArray(inventoryMovements.productId, productIds)).groupBy(inventoryMovements.productId) : [];
      const stockByProduct = new Map(stockRows.map((row) => [row.productId, row.stock]));
      for (const item of soldItems) if (item.productId && (stockByProduct.get(item.productId) ?? 0) < item.quantity) {
        throw Object.assign(new Error("Tồn kho không đủ để thanh toán đơn tạm tính."), { statusCode: 409, code: "INSUFFICIENT_STOCK" });
      }

      const now = new Date();
      if (order.totalVnd > 0) {
        const [payment] = await tx.insert(payments).values({
          orderId: order.id, amountVnd: order.totalVnd, method: paymentMethod, status: "completed",
          externalReference: paymentMethod === "bank_transfer" ? request.body.transferReference?.trim() : idempotencyKey,
        }).returning({ id: payments.id });
        await tx.insert(cashbookEntries).values({
          cashAccountId, paymentId: payment.id, referenceCode: `TH${order.orderNumber}`,
          direction: "in", title: "Thu tiền khách trả", category: "Thu tiền bán hàng",
          counterpartyGroup: "Khách hàng", counterpartyName: "Khách hàng",
          description: `Thanh toán đơn tạm tính ${order.orderNumber}${request.body.transferReference ? ` · ${request.body.transferReference}` : ""}`,
          amountVnd: order.totalVnd, createdByName: account.displayName, occurredAt: now,
        });
      }
      const restockItems = soldItems.filter((item): item is { productId: string; quantity: number } => item.productId !== null);
      if (restockItems.length) await tx.insert(inventoryMovements).values(restockItems.map((item) => ({
        productId: item.productId, quantityDelta: -item.quantity, reason: "sale" as const,
        note: `Bán hàng ${order.orderNumber}`, createdByName: account.displayName, occurredAt: now,
      })));
      await tx.update(orders).set({
        status: "completed", amountTenderedVnd: tendered, changeVnd: tendered - order.totalVnd, closedAt: now, updatedAt: now,
      }).where(eq(orders.id, order.id));
      await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "paid", entityType: "order", entityId: order.id, summary: `Thanh toán đơn tạm tính ${order.orderNumber}.` });
      return { orderNumber: order.orderNumber };
    });
    return { order: result };
  });

  app.post<{ Params: { id: string } }>("/orders/:id/cancel", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        cashierAccountId: orders.cashierAccountId,
      }).from(orders).where(eq(orders.id, request.params.id)).for("update").limit(1);
      if (!order) throw Object.assign(new Error("Không tìm thấy hóa đơn."), { statusCode: 404, code: "ORDER_NOT_FOUND" });
      if (account.role === "cashier" && !(order.status === "awaiting_payment" && order.cashierAccountId === account.id)) {
        throw Object.assign(new Error("Bạn không có quyền hủy hóa đơn này."), { statusCode: 403, code: "FORBIDDEN" });
      }
      if (order.status === "awaiting_payment") {
        const now = new Date();
        await tx.update(orders).set({ status: "cancelled", closedAt: now, updatedAt: now }).where(eq(orders.id, order.id));
        await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "cancelled", entityType: "order", entityId: order.id, summary: `Xóa đơn tạm tính ${order.orderNumber}.` });
        return { id: order.id, status: "cancelled" as const };
      }
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
      await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: "cancelled", entityType: "order", entityId: order.id, summary: `Hủy hóa đơn ${order.orderNumber}.` });
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
        cost: products.costPriceVnd,
        isActive: products.isActive,
      }).from(products).where(inArray(products.id, ids)).orderBy(products.id).for("update");
      if (lockedProducts.length !== ids.length || lockedProducts.some((product) => !product.isActive)) {
        throw Object.assign(new Error("Một hoặc nhiều món không còn khả dụng."), { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
      }
      const [customer] = request.body.customerId ? await tx.select({ id: customers.id, name: customers.name })
        .from(customers).where(and(eq(customers.id, request.body.customerId), eq(customers.isActive, true))).limit(1) : [];
      if (request.body.customerId && !customer) throw Object.assign(new Error("Không tìm thấy khách hàng đang hoạt động."), { statusCode: 409, code: "CUSTOMER_UNAVAILABLE" });
      const priceNow = new Date();
      const overrides = request.body.customerId ? await tx.select({ productId: priceListItems.productId, price: priceListItems.salePriceVnd })
        .from(priceListItems).innerJoin(priceLists, eq(priceLists.id, priceListItems.priceListId))
        .leftJoin(priceListCustomers, eq(priceListCustomers.priceListId, priceLists.id))
        .where(and(eq(priceLists.isActive, true), lte(priceLists.startsAt, priceNow), or(isNull(priceLists.endsAt), gt(priceLists.endsAt, priceNow)),
          or(eq(priceLists.appliesToAllCustomers, true), eq(priceListCustomers.customerId, request.body.customerId))))
        .orderBy(desc(priceLists.startsAt)) : [];
      const effectivePrices = new Map<string, number>();
      for (const item of overrides) if (!effectivePrices.has(item.productId)) effectivePrices.set(item.productId, item.price);

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
        const effectivePrice = effectivePrices.get(productId) ?? product.price;
        if (!Number.isSafeInteger(effectivePrice) || !Number.isSafeInteger(effectivePrice * quantity)) {
          throw Object.assign(new Error("Giá món vượt quá giới hạn hỗ trợ."), { statusCode: 422, code: "INVALID_PRODUCT_PRICE" });
        }
        return { productId, productNameSnapshot: product.name, quantity, unitPriceVnd: effectivePrice, unitCostVnd: product.cost,
          discountVnd: 0, lineTotalVnd: effectivePrice * quantity };
      });
      const subtotal = lineItems.reduce((sum, item) => sum + BigInt(item.lineTotalVnd), 0n);
      if (subtotal > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw Object.assign(new Error("Tổng tiền hàng vượt giới hạn hỗ trợ."), { statusCode: 422, code: "INVALID_ORDER_TOTAL" });
      }
      const discount = BigInt(request.body.discountVnd ?? 0);
      if (discount > subtotal) {
        throw Object.assign(new Error("Tiền giảm giá không được vượt quá tạm tính."), { statusCode: 422, code: "INVALID_DISCOUNT" });
      }
      let discountRemaining = discount;
      const discountedLineItems = lineItems.map((item, index) => {
        const gross = BigInt(item.lineTotalVnd);
        const allocated = index === lineItems.length - 1 ? discountRemaining : subtotal > 0n ? discount * gross / subtotal : 0n;
        discountRemaining -= allocated;
        return { ...item, discountVnd: Number(allocated), lineTotalVnd: Number(gross - allocated) };
      });
      const serviceFee = 0n;
      const total = subtotal - discount;
      if (total < 0n || total > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw Object.assign(new Error("Tổng tiền đơn hàng không hợp lệ."), { statusCode: 422, code: "INVALID_ORDER_TOTAL" });
      }
      const tendered = request.body.amountReceivedVnd ?? Number(total);
      if (!Number.isSafeInteger(tendered) || tendered < 0) {
        throw Object.assign(new Error("Số tiền khách trả không hợp lệ."), { statusCode: 422, code: "INVALID_TENDER" });
      }
      const isEstimate = request.body.mode === "estimate";
      const paidAmount = Math.min(tendered, Number(total));
      const creditAmount = Number(total) - paidAmount;
      const paymentMethod = request.body.paymentMethod ?? "cash";
      let bankCashAccountId: string | null = null;
      if (!isEstimate && paymentMethod === "bank_transfer") {
        if (Number(total) <= 0) {
          throw Object.assign(new Error("Đơn hàng không có số tiền cần thanh toán bằng chuyển khoản."), { statusCode: 422, code: "ZERO_TOTAL_BANK_TRANSFER" });
        }
        if (tendered !== Number(total)) {
          throw Object.assign(new Error("Chuyển khoản cần thanh toán đúng số tiền trên QR."), { statusCode: 422, code: "INVALID_BANK_TRANSFER_AMOUNT" });
        }
        if (!request.body.transferReference?.trim() || !request.body.bankAccountId) {
          throw Object.assign(new Error("Thông tin tài khoản hoặc mã tham chiếu QR không hợp lệ."), { statusCode: 422, code: "INVALID_BANK_TRANSFER_QR" });
        }
        const [bankAccount] = await tx.select({ id: cashAccounts.id }).from(cashAccounts)
          .where(and(eq(cashAccounts.id, request.body.bankAccountId), eq(cashAccounts.accountType, "bank"), eq(cashAccounts.isActive, true))).limit(1);
        if (!bankAccount) throw Object.assign(new Error("Chưa thiết lập tài khoản ngân hàng nhận tiền."), { statusCode: 409, code: "BANK_ACCOUNT_NOT_CONFIGURED" });
        bankCashAccountId = bankAccount.id;
      }
      const selectedCustomerName = request.body.customerName?.trim() || customer?.name || "";
      const [openHandover] = await tx.select({ id: shiftHandoverSheets.id })
        .from(shiftHandoverSheets).where(and(eq(shiftHandoverSheets.employeeId, account.id), sql`${shiftHandoverSheets.closedAt} IS NULL`)).limit(1);
      const orderNumber = `HD${Date.now()}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const [created] = await tx.insert(orders).values({
        idempotencyKey,
        customerId: customer?.id ?? null,
        cashierAccountId: account.id,
        shiftHandoverId: openHandover?.id ?? null,
        customerNameSnapshot: selectedCustomerName || null,
        receiptCode: orderNumber,
        orderNumber,
        status: isEstimate ? "awaiting_payment" : "completed",
        orderType: request.body.orderType,
        serviceLocation: request.body.orderType === "dine_in" ? "Bàn 06" : request.body.orderType === "delivery" ? "Giao hàng" : "Mang đi",
        cashierName: account.displayName,
        orderNote: request.body.note?.trim() || null,
        subtotalVnd: Number(subtotal),
        discountVnd: Number(discount),
        serviceFeePercent: 0,
        serviceFeeVnd: Number(serviceFee),
        totalVnd: Number(total),
        amountTenderedVnd: isEstimate ? 0 : tendered,
        changeVnd: isEstimate ? 0 : Math.max(0, tendered - Number(total)),
        closedAt: isEstimate ? null : new Date(),
      }).returning({ id: orders.id, orderNumber: orders.orderNumber, totalVnd: orders.totalVnd });

      await tx.insert(orderItems).values(discountedLineItems.map((item) => ({ ...item, orderId: created.id })));
      if (!isEstimate && paidAmount > 0) {
        const [payment] = await tx.insert(payments).values({
          orderId: created.id, amountVnd: paidAmount, method: paymentMethod, status: "completed",
          externalReference: paymentMethod === "bank_transfer" ? request.body.transferReference?.trim() : null,
        }).returning({ id: payments.id });
        const cashAccountName = "Tiền mặt";
        if (paymentMethod === "cash") await tx.insert(cashAccounts).values({ name: cashAccountName, accountType: "cash" }).onConflictDoNothing();
        const [cashAccount] = bankCashAccountId
          ? await tx.select({ id: cashAccounts.id }).from(cashAccounts).where(eq(cashAccounts.id, bankCashAccountId)).limit(1)
          : await tx.select({ id: cashAccounts.id }).from(cashAccounts).where(eq(cashAccounts.name, cashAccountName)).limit(1);
        await tx.insert(cashbookEntries).values({
          cashAccountId: cashAccount.id, paymentId: payment.id, referenceCode: `TH${orderNumber}`,
          direction: "in", title: "Thu tiền khách trả", category: "Thu tiền bán hàng",
          counterpartyGroup: "Khách hàng", counterpartyName: selectedCustomerName || "Khách hàng",
          description: `Phiếu thu tự động cho hóa đơn ${orderNumber}${request.body.transferReference ? ` · ${request.body.transferReference}` : ""}`, amountVnd: paidAmount,
          createdByName: account.displayName,
        });
      }
      if (!isEstimate && creditAmount > 0) {
        await tx.insert(payments).values({ orderId: created.id, amountVnd: creditAmount, method: "credit", status: "pending" });
      }
      if (!isEstimate) await tx.insert(inventoryMovements).values(lineItems.map((item) => ({
        productId: item.productId,
        quantityDelta: -item.quantity,
        reason: "sale" as const,
        note: `Bán hàng ${orderNumber}`,
        createdByName: account.displayName,
      })));
      await tx.insert(auditLogs).values({ accountId: account.id, actorName: account.displayName, action: isEstimate ? "estimated" : "created", entityType: "order", entityId: created.id, summary: `${isEstimate ? "Tạm tính đơn" : "Tạo hóa đơn"} ${created.orderNumber}.` });

      return { ...created, changeVnd: Math.max(0, tendered - Number(total)), creditVnd: creditAmount };
    });

    return reply.code(201).send({ order: result });
  });
};
