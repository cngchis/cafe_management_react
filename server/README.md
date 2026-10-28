# Backend

Fastify API using TypeScript, Drizzle ORM and PostgreSQL.

## Local setup

1. Create a local PostgreSQL database.
2. Apply `database/schema.sql`, then `database/accounts.sql` with pgAdmin Query Tool or `psql`.
3. Apply `database/seed.sql` to load the demo catalog if you want sample products.
4. Apply `database/migrations/0002_pos_sales.sql` to enable POS order idempotency and sale stock movements.
5. Apply migrations `0003_inventory_checks.sql` through `0006_work_shifts.sql` in order for inventory history, employee pay rates, and work schedules.
6. Apply `database/migrations/0007_invoice_cancellations.sql` if it has not already been applied, then apply `database/migrations/0008_morepage_operations.sql`. Migration 0008 adds price lists, purchase receipts, attendance, shift handovers, audit history, and POS customer/credit fields.
7. Apply `database/migrations/0009_bank_transfer_qr.sql` to enable receiving bank accounts and POS transfer QR codes.
8. Copy `.env.example` to `.env` and set a unique `JWT_SECRET` (at least 32 characters) and `DATABASE_URL`.
9. Run `npm run dev:api`; the API listens on `http://localhost:3000` by default.

The API does not create accounts or seed passwords. Add an account only after choosing an approved password creation flow, storing an Argon2 hash in `password_hash`.

## Endpoints

- `GET /api/health`
- `POST /api/auth/login` with `{ "username", "password", "destination": "/" | "/pos" }`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/products` (signed-in accounts)
- `POST /api/products` and `PATCH /api/products/:id` (owner/manager only)
- `GET /api/orders` (signed-in accounts; 100 most recent completed orders)
- `GET /api/orders/:id` (signed-in accounts; order lines and payment summary)
- `GET /api/dashboard/summary` (signed-in accounts; today, yesterday, seven-day revenue, best sellers, recent completed orders)
- `POST /api/orders` (signed-in accounts; requires an `Idempotency-Key` UUID header)
- `GET /api/cashbook/bank-accounts` (signed-in accounts; used by POS)
- `POST /api/cashbook/bank-accounts` and `PATCH /api/cashbook/bank-accounts/:id/default` (owner/manager only)
- `/api/employees` (owner-only employee account and hourly pay management)
- `/api/work-shifts` (owner-only weekly shift scheduling)
- `/api/payroll` and `/api/payroll/export` (owner-only monthly scheduled-hours payroll and `.xlsx` export)
- `/api/customers` (list; owner/manager can create)
- `/api/price-lists`, `/api/purchases`, `/api/attendance`, `/api/shift-handovers`, `/api/reports`, and `/api/activity`

Login uses an HTTP-only session cookie. The frontend Vite server proxies `/api` to port 3000 during development.
Product stock is calculated from `inventory_movements`; creating or editing a stock balance writes a movement record in the same transaction as the product change.
POS checkout calculates prices from the catalog and active customer price lists, verifies available stock, and writes the order, item snapshots, payment/receivable, cashbook entry, and stock movements in one transaction. It uses the displayed 5% service fee. The purchase screen records received stock and updates product cost; supplier settlement is not recorded as a cashbook payment. Historical item costs are initialized from current product costs when migration 0008 is applied.

Migrations are SQL files and are not applied automatically by the API. Apply them to the target PostgreSQL database before deploying code that uses these endpoints.
