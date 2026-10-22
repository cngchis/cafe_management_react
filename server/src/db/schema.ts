import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, boolean, index, uniqueIndex, bigint, numeric, integer, char, check } from "drizzle-orm/pg-core";

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["owner", "manager", "cashier"] }).notNull().default("cashier"),
    hourlyRateVnd: bigint("hourly_rate_vnd", { mode: "number" }).notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("accounts_username_case_insensitive_unique_idx").on(sql`lower(${table.username})`),
    index("accounts_active_role_idx").on(table.role).where(sql`${table.isActive}`),
    check("accounts_hourly_rate_nonnegative", sql`${table.hourlyRateVnd} >= 0`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    menuType: text("menu_type").notNull().default("Món thường"),
    imageUrl: text("image_url"),
    tag: text("tag"),
    salePriceVnd: bigint("sale_price_vnd", { mode: "number" }).notNull().default(0),
    costPriceVnd: bigint("cost_price_vnd", { mode: "number" }).notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("products_sku_key").on(table.sku),
    index("products_category_active_idx").on(table.category, table.name).where(sql`${table.isActive}`),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantityDelta: numeric("quantity_delta", { precision: 14, scale: 3, mode: "number" }).notNull(),
    reason: text("reason", { enum: ["opening_balance", "manual_adjustment", "correction", "sale"] }).notNull(),
    note: text("note"),
    createdByName: text("created_by_name"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("inventory_product_history_idx").on(table.productId, table.occurredAt.desc())],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key"),
    receiptCode: text("receipt_code").notNull(),
    orderNumber: text("order_number").notNull(),
    status: text("status", { enum: ["open", "in_progress", "awaiting_payment", "completed", "cancelled"] }).notNull().default("open"),
    orderType: text("order_type", { enum: ["dine_in", "takeaway", "delivery", "staff"] }).notNull(),
    serviceLocation: text("service_location"),
    guestCount: integer("guest_count").notNull().default(1),
    cashierName: text("cashier_name"),
    orderNote: text("order_note"),
    currencyCode: char("currency_code", { length: 3 }).notNull().default("VND"),
    subtotalVnd: bigint("subtotal_vnd", { mode: "number" }).notNull().default(0),
    discountVnd: bigint("discount_vnd", { mode: "number" }).notNull().default(0),
    serviceFeePercent: numeric("service_fee_percent", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    serviceFeeVnd: bigint("service_fee_vnd", { mode: "number" }).notNull().default(0),
    taxIncluded: boolean("tax_included").notNull().default(true),
    totalVnd: bigint("total_vnd", { mode: "number" }).notNull().default(0),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_receipt_code_unique").on(table.receiptCode),
    uniqueIndex("orders_number_unique").on(table.orderNumber),
    uniqueIndex("orders_idempotency_key_unique_idx").on(table.idempotencyKey).where(sql`${table.idempotencyKey} IS NOT NULL`),
    index("orders_ordered_at_idx").on(table.orderedAt.desc()),
    index("orders_status_ordered_at_idx").on(table.status, table.orderedAt.desc()),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    portionSnapshot: text("portion_snapshot"),
    note: text("note"),
    quantity: integer("quantity").notNull(),
    unitPriceVnd: bigint("unit_price_vnd", { mode: "number" }).notNull(),
    discountVnd: bigint("discount_vnd", { mode: "number" }).notNull().default(0),
    lineTotalVnd: bigint("line_total_vnd", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_product_id_idx").on(table.productId).where(sql`${table.productId} IS NOT NULL`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(),
    method: text("method", { enum: ["cash", "bank_transfer", "card", "other"] }).notNull(),
    status: text("status", { enum: ["pending", "completed", "failed", "refunded"] }).notNull().default("completed"),
    externalReference: text("external_reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payments_order_paid_at_idx").on(table.orderId, table.paidAt.desc())],
);

export const cashAccounts = pgTable(
  "cash_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    accountType: text("account_type", { enum: ["cash", "bank"] }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const cashbookEntries = pgTable(
  "cashbook_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cashAccountId: uuid("cash_account_id").notNull().references(() => cashAccounts.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id").unique().references(() => payments.id, { onDelete: "restrict" }),
    referenceCode: text("reference_code").notNull().unique(),
    direction: text("direction", { enum: ["in", "out"] }).notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    counterpartyGroup: text("counterparty_group"),
    counterpartyName: text("counterparty_name"),
    description: text("description"),
    amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(),
    createdByName: text("created_by_name"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("cashbook_account_occurred_at_idx").on(table.cashAccountId, table.occurredAt.desc()),
    index("cashbook_occurred_at_idx").on(table.occurredAt.desc()),
  ],
);

export const inventoryChecks = pgTable("inventory_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkedByName: text("checked_by_name").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryCheckItems = pgTable("inventory_check_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkId: uuid("check_id").notNull().references(() => inventoryChecks.id, { onDelete: "restrict" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  expectedQuantity: numeric("expected_quantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  countedQuantity: numeric("counted_quantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  deltaQuantity: numeric("delta_quantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
}, (table) => [
  uniqueIndex("inventory_check_items_check_product_unique_idx").on(table.checkId, table.productId),
  index("inventory_check_items_product_idx").on(table.productId),
  check("inventory_check_items_counted_nonnegative", sql`${table.countedQuantity} >= 0`),
  check("inventory_check_items_delta_consistent", sql`${table.deltaQuantity} = ${table.countedQuantity} - ${table.expectedQuantity}`),
]);

export const workShifts = pgTable("work_shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  createdByName: text("created_by_name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  breakMinutes: integer("break_minutes").notNull().default(0),
  hourlyRateVnd: bigint("hourly_rate_vnd", { mode: "number" }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("work_shifts_employee_start_idx").on(table.employeeId, table.startsAt),
  index("work_shifts_start_idx").on(table.startsAt),
  check("work_shifts_time_order_check", sql`${table.endsAt} > ${table.startsAt}`),
  check("work_shifts_break_nonnegative", sql`${table.breakMinutes} >= 0`),
  check("work_shifts_hourly_rate_nonnegative", sql`${table.hourlyRateVnd} >= 0`),
  check("work_shifts_break_within_duration", sql`${table.breakMinutes} * 60 < extract(epoch from (${table.endsAt} - ${table.startsAt}))`),
]);

export type Account = typeof accounts.$inferSelect;
export type ProductRecord = typeof products.$inferSelect;
