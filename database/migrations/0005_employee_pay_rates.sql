BEGIN;

ALTER TABLE accounts
    ADD COLUMN hourly_rate_vnd bigint NOT NULL DEFAULT 0,
    ADD CONSTRAINT accounts_hourly_rate_nonnegative CHECK (hourly_rate_vnd >= 0);

COMMIT;
