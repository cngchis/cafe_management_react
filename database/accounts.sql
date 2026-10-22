-- Supplemental account schema for future backend authentication.
-- Apply after schema.sql. Do not store plaintext passwords in this table.

BEGIN;

CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text NOT NULL,
    password_hash text NOT NULL,
    display_name text NOT NULL,
    role text NOT NULL DEFAULT 'cashier',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT accounts_username_not_blank CHECK (length(btrim(username)) > 0),
    CONSTRAINT accounts_password_hash_not_blank CHECK (length(btrim(password_hash)) > 0),
    CONSTRAINT accounts_display_name_not_blank CHECK (length(btrim(display_name)) > 0),
    CONSTRAINT accounts_role_check CHECK (role IN ('owner', 'manager', 'cashier'))
);

CREATE UNIQUE INDEX accounts_username_case_insensitive_unique_idx
    ON accounts (lower(username));

CREATE INDEX accounts_active_role_idx ON accounts (role) WHERE is_active;

COMMIT;
