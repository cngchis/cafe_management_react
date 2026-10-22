BEGIN;

ALTER TABLE inventory_check_items
    DROP CONSTRAINT inventory_check_items_quantities_nonnegative;

ALTER TABLE inventory_check_items
    ADD CONSTRAINT inventory_check_items_counted_nonnegative
    CHECK (counted_quantity >= 0);

COMMIT;
