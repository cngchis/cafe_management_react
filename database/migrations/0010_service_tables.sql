BEGIN;

CREATE TABLE service_tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name text NOT NULL,
    table_name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT service_tables_room_name_nonempty CHECK (length(trim(room_name)) > 0),
    CONSTRAINT service_tables_table_name_nonempty CHECK (length(trim(table_name)) > 0)
);

CREATE UNIQUE INDEX service_tables_room_table_active_unique_idx
    ON service_tables (lower(room_name), lower(table_name)) WHERE is_active;
CREATE INDEX service_tables_active_room_idx
    ON service_tables (lower(room_name), table_name) WHERE is_active;

COMMIT;
