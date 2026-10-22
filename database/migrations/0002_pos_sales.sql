-- Additive changes for POS order creation. Apply once after schema.sql and accounts.sql.
BEGIN;

ALTER TABLE orders ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX orders_idempotency_key_unique_idx
    ON orders (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE inventory_movements
    DROP CONSTRAINT inventory_movements_reason_check;
ALTER TABLE inventory_movements
    ADD CONSTRAINT inventory_movements_reason_check
    CHECK (reason IN ('opening_balance', 'manual_adjustment', 'correction', 'sale'));

COMMIT;
