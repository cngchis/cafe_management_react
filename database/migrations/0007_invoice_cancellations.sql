-- Allow inventory history to record stock restored after an invoice cancellation.
BEGIN;

ALTER TABLE inventory_movements
    DROP CONSTRAINT inventory_movements_reason_check;

ALTER TABLE inventory_movements
    ADD CONSTRAINT inventory_movements_reason_check
    CHECK (reason IN ('opening_balance', 'manual_adjustment', 'correction', 'sale', 'sale_cancellation'));

COMMIT;
