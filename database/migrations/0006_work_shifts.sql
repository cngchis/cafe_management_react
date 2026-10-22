BEGIN;

CREATE TABLE work_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    created_by_name text NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    break_minutes integer NOT NULL DEFAULT 0,
    hourly_rate_vnd bigint NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT work_shifts_time_order_check CHECK (ends_at > starts_at),
    CONSTRAINT work_shifts_break_nonnegative CHECK (break_minutes >= 0),
    CONSTRAINT work_shifts_hourly_rate_nonnegative CHECK (hourly_rate_vnd >= 0),
    CONSTRAINT work_shifts_break_within_duration CHECK (break_minutes * 60 < EXTRACT(EPOCH FROM (ends_at - starts_at)))
);

CREATE INDEX work_shifts_employee_start_idx ON work_shifts (employee_id, starts_at);
CREATE INDEX work_shifts_start_idx ON work_shifts (starts_at);

COMMIT;
