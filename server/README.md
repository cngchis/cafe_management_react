# Backend

Fastify API using TypeScript, Drizzle ORM and PostgreSQL.

## Local setup

1. Create a local PostgreSQL database.
2. Apply `database/schema.sql`, then `database/accounts.sql` with pgAdmin Query Tool or `psql`.
3. Apply `database/seed.sql` to load the demo catalog if you want sample products.
4. Apply `database/migrations/0002_pos_sales.sql` to enable POS order idempotency and sale stock movements.
5. Apply migrations `0003_inventory_checks.sql` through `0006_work_shifts.sql` in order for inventory history, employee pay rates, and work schedules.
6. Copy `.env.example` to `.env` and set a unique `JWT_SECRET` (at least 32 characters) and `DATABASE_URL`.
7. Run `npm run dev:api`; the API listens on `http://localhost:3000` by default.

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
- `/api/employees` (owner-only employee account and hourly pay management)
- `/api/work-shifts` (owner-only weekly shift scheduling)
- `/api/payroll` and `/api/payroll/export` (owner-only monthly scheduled-hours payroll and `.xlsx` export)

Login uses an HTTP-only session cookie. The frontend Vite server proxies `/api` to port 3000 during development.
Product stock is calculated from `inventory_movements`; creating or editing a stock balance writes a movement record in the same transaction as the product change.
POS checkout calculates prices from the catalog, verifies available stock, and writes the completed order, item snapshots, cash payment, and stock movements in one transaction. The current POS screen supports cash payment only and uses its displayed 5% service fee.
