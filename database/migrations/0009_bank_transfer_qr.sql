-- Add receiving bank details for POS VietQR transfer checkout.
BEGIN;

ALTER TABLE cash_accounts
    ADD COLUMN bank_name text,
    ADD COLUMN bank_code text,
    ADD COLUMN account_number text,
    ADD COLUMN account_holder text,
    ADD COLUMN is_default boolean NOT NULL DEFAULT false;

ALTER TABLE cash_accounts
    ADD CONSTRAINT cash_accounts_bank_details_check
    CHECK (
        (bank_code IS NULL AND account_number IS NULL AND account_holder IS NULL AND bank_name IS NULL AND NOT is_default)
        OR
        (account_type = 'bank' AND bank_code IS NOT NULL AND account_number IS NOT NULL AND account_holder IS NOT NULL AND bank_name IS NOT NULL)
    );

CREATE UNIQUE INDEX cash_accounts_default_bank_unique_idx
    ON cash_accounts (is_default) WHERE account_type = 'bank' AND is_default;
CREATE UNIQUE INDEX cash_accounts_bank_identity_unique_idx
    ON cash_accounts (bank_code, account_number) WHERE account_type = 'bank' AND bank_code IS NOT NULL AND account_number IS NOT NULL;

COMMIT;
