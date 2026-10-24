-- Support price lists, stock receiving, attendance, shift handovers and reports.
-- Apply with the normal migration process; this file has not been executed.
BEGIN;

CREATE TABLE price_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    applies_to_all_customers boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_by_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT price_lists_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT price_lists_time_range CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX price_lists_active_period_idx ON price_lists (starts_at, ends_at) WHERE is_active;

CREATE TABLE price_list_customers (
    price_list_id uuid NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    PRIMARY KEY (price_list_id, customer_id)
);
CREATE INDEX price_list_customers_customer_idx ON price_list_customers (customer_id, price_list_id);

CREATE TABLE price_list_items (
    price_list_id uuid NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    sale_price_vnd bigint NOT NULL,
    PRIMARY KEY (price_list_id, product_id),
    CONSTRAINT price_list_items_price_nonnegative CHECK (sale_price_vnd >= 0)
);
CREATE INDEX price_list_items_product_idx ON price_list_items (product_id, price_list_id);

CREATE TABLE purchase_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number text NOT NULL UNIQUE,
    supplier_name text,
    received_at timestamptz NOT NULL DEFAULT now(),
    total_vnd bigint NOT NULL,
    note text,
    created_by_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT purchase_receipts_total_nonnegative CHECK (total_vnd >= 0)
);
CREATE INDEX purchase_receipts_received_at_idx ON purchase_receipts (received_at DESC);

CREATE TABLE purchase_receipt_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_receipt_id uuid NOT NULL REFERENCES purchase_receipts(id) ON DELETE RESTRICT,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name_snapshot text NOT NULL,
    quantity numeric(14, 3) NOT NULL,
    unit_cost_vnd bigint NOT NULL,
    line_total_vnd bigint NOT NULL,
    CONSTRAINT purchase_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT purchase_items_cost_nonnegative CHECK (unit_cost_vnd >= 0 AND line_total_vnd >= 0)
);
CREATE INDEX purchase_items_receipt_idx ON purchase_receipt_items (purchase_receipt_id);
CREATE INDEX purchase_items_product_idx ON purchase_receipt_items (product_id);

ALTER TABLE inventory_movements
    DROP CONSTRAINT inventory_movements_reason_check;
ALTER TABLE inventory_movements
    ADD CONSTRAINT inventory_movements_reason_check
    CHECK (reason IN ('opening_balance', 'manual_adjustment', 'correction', 'sale', 'sale_cancellation', 'purchase_receipt'));
ALTER TABLE inventory_movements
    ADD COLUMN purchase_receipt_item_id uuid REFERENCES purchase_receipt_items(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX inventory_movements_purchase_item_unique_idx
    ON inventory_movements (purchase_receipt_item_id) WHERE purchase_receipt_item_id IS NOT NULL;

CREATE TABLE attendance_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    clock_in_at timestamptz NOT NULL DEFAULT now(),
    clock_out_at timestamptz,
    note text,
    recorded_by_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT attendance_time_order CHECK (clock_out_at IS NULL OR clock_out_at > clock_in_at)
);
CREATE UNIQUE INDEX attendance_one_open_shift_per_employee_idx
    ON attendance_records (employee_id) WHERE clock_out_at IS NULL;
CREATE INDEX attendance_employee_clock_in_idx ON attendance_records (employee_id, clock_in_at DESC);

CREATE TABLE shift_handover_sheets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    opened_by_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
    closed_by_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
    opened_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    opening_cash_vnd bigint NOT NULL DEFAULT 0,
    closing_cash_vnd bigint,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT handover_cash_nonnegative CHECK (opening_cash_vnd >= 0 AND (closing_cash_vnd IS NULL OR closing_cash_vnd >= 0)),
    CONSTRAINT handover_time_order CHECK (closed_at IS NULL OR closed_at > opened_at)
);
CREATE UNIQUE INDEX handover_one_open_per_employee_idx
    ON shift_handover_sheets (employee_id) WHERE closed_at IS NULL;
CREATE INDEX handover_employee_opened_idx ON shift_handover_sheets (employee_id, opened_at DESC);

ALTER TABLE orders
    ADD COLUMN cashier_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
    ADD COLUMN shift_handover_id uuid REFERENCES shift_handover_sheets(id) ON DELETE SET NULL,
    ADD COLUMN customer_name_snapshot text,
    ADD COLUMN amount_tendered_vnd bigint NOT NULL DEFAULT 0,
    ADD COLUMN change_vnd bigint NOT NULL DEFAULT 0;
UPDATE orders SET amount_tendered_vnd = total_vnd WHERE amount_tendered_vnd = 0;
ALTER TABLE orders ADD CONSTRAINT orders_tender_nonnegative CHECK (amount_tendered_vnd >= 0 AND change_vnd >= 0);
CREATE INDEX orders_cashier_ordered_at_idx ON orders (cashier_account_id, ordered_at DESC);
CREATE INDEX orders_handover_idx ON orders (shift_handover_id) WHERE shift_handover_id IS NOT NULL;

ALTER TABLE order_items
    ADD COLUMN unit_cost_vnd bigint NOT NULL DEFAULT 0;
ALTER TABLE order_items
    ADD CONSTRAINT order_items_unit_cost_nonnegative CHECK (unit_cost_vnd >= 0);
UPDATE order_items oi SET unit_cost_vnd = p.cost_price_vnd FROM products p WHERE p.id = oi.product_id;

ALTER TABLE payments DROP CONSTRAINT payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('cash', 'bank_transfer', 'card', 'other', 'credit'));
CREATE INDEX payments_method_status_paid_at_idx ON payments (method, status, paid_at DESC);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
    actor_name text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    summary text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT audit_summary_not_blank CHECK (length(btrim(summary)) > 0)
);
CREATE INDEX audit_logs_occurred_at_idx ON audit_logs (occurred_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, occurred_at DESC);

COMMIT;
