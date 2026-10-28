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

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  pointsBalance: integer("points_balance").notNull().default(0),
  membershipTier: text("membership_tier").notNull().default("Mới"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("customers_phone_unique_idx").on(table.phone).where(sql`${table.phone} IS NOT NULL`),
  index("customers_name_idx").on(table.name),
]);

export const priceLists = pgTable("price_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  appliesToAllCustomers: boolean("applies_to_all_customers").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdByAccountId: uuid("created_by_account_id").references(() => accounts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("price_lists_active_period_idx").on(table.startsAt, table.endsAt).where(sql`${table.isActive}`)]);

export const priceListCustomers = pgTable("price_list_customers", {
  priceListId: uuid("price_list_id").notNull().references(() => priceLists.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("price_list_customers_pair_idx").on(table.priceListId, table.customerId),
  index("price_list_customers_customer_idx").on(table.customerId, table.priceListId),
]);

export const priceListItems = pgTable("price_list_items", {
  priceListId: uuid("price_list_id").notNull().references(() => priceLists.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  salePriceVnd: bigint("sale_price_vnd", { mode: "number" }).notNull(),
}, (table) => [
  uniqueIndex("price_list_items_pair_idx").on(table.priceListId, table.productId),
  index("price_list_items_product_idx").on(table.productId, table.priceListId),
  check("price_list_items_price_nonnegative", sql`${table.salePriceVnd} >= 0`),
]);

export const purchaseReceipts = pgTable("purchase_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  receiptNumber: text("receipt_number").notNull(),
  supplierName: text("supplier_name"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  totalVnd: bigint("total_vnd", { mode: "number" }).notNull(),
  note: text("note"),
  createdByAccountId: uuid("created_by_account_id").references(() => accounts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("purchase_receipts_number_idx").on(table.receiptNumber),
  index("purchase_receipts_received_at_idx").on(table.receivedAt.desc()),
  check("purchase_receipts_total_nonnegative", sql`${table.totalVnd} >= 0`),
]);

export const purchaseReceiptItems = pgTable("purchase_receipt_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseReceiptId: uuid("purchase_receipt_id").notNull().references(() => purchaseReceipts.id, { onDelete: "restrict" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  unitCostVnd: bigint("unit_cost_vnd", { mode: "number" }).notNull(),
  lineTotalVnd: bigint("line_total_vnd", { mode: "number" }).notNull(),
}, (table) => [
  index("purchase_items_receipt_idx").on(table.purchaseReceiptId),
  index("purchase_items_product_idx").on(table.productId),
  check("purchase_items_quantity_positive", sql`${table.quantity} > 0`),
  check("purchase_items_cost_nonnegative", sql`${table.unitCostVnd} >= 0 AND ${table.lineTotalVnd} >= 0`),
]);

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  clockInAt: timestamp("clock_in_at", { withTimezone: true }).notNull().defaultNow(),
  clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
  note: text("note"),
  recordedByAccountId: uuid("recorded_by_account_id").references(() => accounts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("attendance_one_open_per_employee_idx").on(table.employeeId).where(sql`${table.clockOutAt} IS NULL`),
  index("attendance_employee_clock_in_idx").on(table.employeeId, table.clockInAt.desc()),
  check("attendance_time_order", sql`${table.clockOutAt} IS NULL OR ${table.clockOutAt} > ${table.clockInAt}`),
]);

export const shiftHandoverSheets = pgTable("shift_handover_sheets", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  openedByAccountId: uuid("opened_by_account_id").references(() => accounts.id, { onDelete: "set null" }),
  closedByAccountId: uuid("closed_by_account_id").references(() => accounts.id, { onDelete: "set null" }),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingCashVnd: bigint("opening_cash_vnd", { mode: "number" }).notNull().default(0),
  closingCashVnd: bigint("closing_cash_vnd", { mode: "number" }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("handover_one_open_per_employee_idx").on(table.employeeId).where(sql`${table.closedAt} IS NULL`),
  index("handover_employee_opened_idx").on(table.employeeId, table.openedAt.desc()),
  check("handover_cash_nonnegative", sql`${table.openingCashVnd} >= 0 AND (${table.closingCashVnd} IS NULL OR ${table.closingCashVnd} >= 0)`),
  check("handover_time_order", sql`${table.closedAt} IS NULL OR ${table.closedAt} > ${table.openedAt}`),
]);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantityDelta: numeric("quantity_delta", { precision: 14, scale: 3, mode: "number" }).notNull(),
    reason: text("reason", { enum: ["opening_balance", "manual_adjustment", "correction", "sale", "sale_cancellation", "purchase_receipt"] }).notNull(),
    purchaseReceiptItemId: uuid("purchase_receipt_item_id").references(() => purchaseReceiptItems.id, { onDelete: "set null" }),
    note: text("note"),
    createdByName: text("created_by_name"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("inventory_product_history_idx").on(table.productId, table.occurredAt.desc()),
    uniqueIndex("inventory_movements_purchase_item_unique_idx").on(table.purchaseReceiptItemId).where(sql`${table.purchaseReceiptItemId} IS NOT NULL`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    cashierAccountId: uuid("cashier_account_id").references(() => accounts.id, { onDelete: "set null" }),
    shiftHandoverId: uuid("shift_handover_id").references(() => shiftHandoverSheets.id, { onDelete: "set null" }),
    customerNameSnapshot: text("customer_name_snapshot"),
    amountTenderedVnd: bigint("amount_tendered_vnd", { mode: "number" }).notNull().default(0),
    changeVnd: bigint("change_vnd", { mode: "number" }).notNull().default(0),
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
    unitCostVnd: bigint("unit_cost_vnd", { mode: "number" }).notNull().default(0),
    lineTotalVnd: bigint("line_total_vnd", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_product_id_idx").on(table.productId).where(sql`${table.productId} IS NOT NULL`),
    check("order_items_unit_cost_nonnegative", sql`${table.unitCostVnd} >= 0`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(),
    method: text("method", { enum: ["cash", "bank_transfer", "card", "other", "credit"] }).notNull(),
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
    bankName: text("bank_name"),
    bankCode: text("bank_code"),
    accountNumber: text("account_number"),
    accountHolder: text("account_holder"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cash_accounts_default_bank_unique_idx").on(table.isDefault).where(sql`${table.accountType} = 'bank' AND ${table.isDefault}`),
    uniqueIndex("cash_accounts_bank_identity_unique_idx").on(table.bankCode, table.accountNumber).where(sql`${table.accountType} = 'bank' AND ${table.bankCode} IS NOT NULL AND ${table.accountNumber} IS NOT NULL`),
    check("cash_accounts_bank_details_check", sql`(
      ${table.bankCode} IS NULL AND ${table.accountNumber} IS NULL AND ${table.accountHolder} IS NULL AND ${table.bankName} IS NULL AND NOT ${table.isDefault}
    ) OR (
      ${table.accountType} = 'bank' AND ${table.bankCode} IS NOT NULL AND ${table.accountNumber} IS NOT NULL AND ${table.accountHolder} IS NOT NULL AND ${table.bankName} IS NOT NULL
    )`),
  ],
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

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  summary: text("summary").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_logs_occurred_at_idx").on(table.occurredAt.desc()),
  index("audit_logs_entity_idx").on(table.entityType, table.entityId, table.occurredAt.desc()),
]);

export type Account = typeof accounts.$inferSelect;
export type ProductRecord = typeof products.$inferSelect;
