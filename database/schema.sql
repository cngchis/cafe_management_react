-- Proposed PostgreSQL schema for the CỘI Coffee & Beer point-of-sale UI.
-- This file is a design artifact only; it has not been applied to a database.
-- Requires PostgreSQL 13+ for gen_random_uuid().

BEGIN;

CREATE TABLE store_settings (
    id smallint PRIMARY KEY DEFAULT 1,
    store_name text NOT NULL,
    phone text,
    service_fee_percent numeric(5, 2) NOT NULL DEFAULT 0,
    order_notifications_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT store_settings_singleton_check CHECK (id = 1),
    CONSTRAINT store_settings_name_not_blank CHECK (length(btrim(store_name)) > 0),
    CONSTRAINT store_settings_service_fee_percent_check CHECK (service_fee_percent BETWEEN 0 AND 100)
);

CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sku text NOT NULL UNIQUE,
    name text NOT NULL,
    category text NOT NULL,
    menu_type text NOT NULL DEFAULT 'Món thường',
    image_url text,
    tag text,
    sale_price_vnd bigint NOT NULL DEFAULT 0,
    cost_price_vnd bigint NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT products_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT products_sale_price_nonnegative CHECK (sale_price_vnd >= 0),
    CONSTRAINT products_cost_price_nonnegative CHECK (cost_price_vnd >= 0)
);

CREATE INDEX products_category_active_idx ON products (category, name) WHERE is_active;

CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text,
    points_balance integer NOT NULL DEFAULT 0,
    membership_tier text NOT NULL DEFAULT 'Mới',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT customers_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT customers_points_nonnegative CHECK (points_balance >= 0)
);

CREATE UNIQUE INDEX customers_phone_unique_idx ON customers (phone) WHERE phone IS NOT NULL;
CREATE INDEX customers_name_idx ON customers (name);

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    receipt_code text NOT NULL,
    order_number text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    order_type text NOT NULL,
    service_location text,
    guest_count integer NOT NULL DEFAULT 1,
    cashier_name text,
    order_note text,
    currency_code char(3) NOT NULL DEFAULT 'VND',
    subtotal_vnd bigint NOT NULL DEFAULT 0,
    discount_vnd bigint NOT NULL DEFAULT 0,
    service_fee_percent numeric(5, 2) NOT NULL DEFAULT 0,
    service_fee_vnd bigint NOT NULL DEFAULT 0,
    tax_included boolean NOT NULL DEFAULT true,
    total_vnd bigint NOT NULL DEFAULT 0,
    ordered_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orders_receipt_code_unique UNIQUE (receipt_code),
    CONSTRAINT orders_number_unique UNIQUE (order_number),
    CONSTRAINT orders_status_check CHECK (status IN ('open', 'in_progress', 'awaiting_payment', 'completed', 'cancelled')),
    CONSTRAINT orders_type_check CHECK (order_type IN ('dine_in', 'takeaway', 'delivery', 'staff')),
    CONSTRAINT orders_guest_count_positive CHECK (guest_count > 0),
    CONSTRAINT orders_currency_vnd_only CHECK (currency_code = 'VND'),
    CONSTRAINT orders_amounts_nonnegative CHECK (subtotal_vnd >= 0 AND discount_vnd >= 0 AND service_fee_vnd >= 0 AND total_vnd >= 0),
    CONSTRAINT orders_discount_lte_subtotal CHECK (discount_vnd <= subtotal_vnd),
    CONSTRAINT orders_service_fee_percent_check CHECK (service_fee_percent BETWEEN 0 AND 100),
    CONSTRAINT orders_total_matches_components CHECK (total_vnd = subtotal_vnd - discount_vnd + service_fee_vnd),
    CONSTRAINT orders_closed_at_consistent CHECK ((status IN ('completed', 'cancelled')) = (closed_at IS NOT NULL))
);

CREATE INDEX orders_ordered_at_idx ON orders (ordered_at DESC);
CREATE INDEX orders_customer_ordered_at_idx ON orders (customer_id, ordered_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX orders_status_ordered_at_idx ON orders (status, ordered_at DESC);

CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    product_id uuid REFERENCES products(id) ON DELETE SET NULL,
    product_name_snapshot text NOT NULL,
    portion_snapshot text,
    note text,
    quantity integer NOT NULL,
    unit_price_vnd bigint NOT NULL,
    discount_vnd bigint NOT NULL DEFAULT 0,
    line_total_vnd bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_items_prices_nonnegative CHECK (unit_price_vnd >= 0 AND discount_vnd >= 0 AND line_total_vnd >= 0),
    CONSTRAINT order_items_discount_lte_gross CHECK (discount_vnd <= quantity::bigint * unit_price_vnd),
    CONSTRAINT order_items_total_matches_components CHECK (line_total_vnd = quantity::bigint * unit_price_vnd - discount_vnd)
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX order_items_product_id_idx ON order_items (product_id) WHERE product_id IS NOT NULL;

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    amount_vnd bigint NOT NULL,
    method text NOT NULL,
    status text NOT NULL DEFAULT 'completed',
    external_reference text,
    paid_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payments_amount_positive CHECK (amount_vnd > 0),
    CONSTRAINT payments_method_check CHECK (method IN ('cash', 'bank_transfer', 'card', 'other')),
    CONSTRAINT payments_status_check CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

CREATE INDEX payments_order_paid_at_idx ON payments (order_id, paid_at DESC);

CREATE TABLE cash_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    account_type text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cash_accounts_name_unique UNIQUE (name),
    CONSTRAINT cash_accounts_type_check CHECK (account_type IN ('cash', 'bank'))
);

CREATE TABLE cashbook_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_account_id uuid NOT NULL REFERENCES cash_accounts(id) ON DELETE RESTRICT,
    payment_id uuid UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
    reference_code text NOT NULL,
    direction text NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    counterparty_group text,
    counterparty_name text,
    description text,
    amount_vnd bigint NOT NULL,
    created_by_name text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cashbook_reference_code_unique UNIQUE (reference_code),
    CONSTRAINT cashbook_direction_check CHECK (direction IN ('in', 'out')),
    CONSTRAINT cashbook_amount_positive CHECK (amount_vnd > 0),
    CONSTRAINT cashbook_title_not_blank CHECK (length(btrim(title)) > 0)
);

CREATE INDEX cashbook_account_occurred_at_idx ON cashbook_entries (cash_account_id, occurred_at DESC);
CREATE INDEX cashbook_occurred_at_idx ON cashbook_entries (occurred_at DESC);

CREATE TABLE inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_delta numeric(14, 3) NOT NULL,
    reason text NOT NULL,
    note text,
    created_by_name text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT inventory_movements_nonzero_delta CHECK (quantity_delta <> 0),
    CONSTRAINT inventory_movements_reason_check CHECK (reason IN ('opening_balance', 'manual_adjustment', 'correction', 'sale', 'sale_cancellation'))
);

CREATE INDEX inventory_product_history_idx ON inventory_movements (product_id, occurred_at DESC);

COMMIT;
