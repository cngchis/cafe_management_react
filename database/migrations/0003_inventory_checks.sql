BEGIN;

CREATE TABLE inventory_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    checked_by_name text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_check_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id uuid NOT NULL REFERENCES inventory_checks(id) ON DELETE RESTRICT,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name_snapshot text NOT NULL,
    expected_quantity numeric(14, 3) NOT NULL,
    counted_quantity numeric(14, 3) NOT NULL,
    delta_quantity numeric(14, 3) NOT NULL,
    CONSTRAINT inventory_check_items_check_product_unique_idx UNIQUE (check_id, product_id),
    CONSTRAINT inventory_check_items_quantities_nonnegative CHECK (expected_quantity >= 0 AND counted_quantity >= 0),
    CONSTRAINT inventory_check_items_delta_consistent CHECK (delta_quantity = counted_quantity - expected_quantity)
);

CREATE INDEX inventory_check_items_product_idx ON inventory_check_items (product_id);

COMMIT;
