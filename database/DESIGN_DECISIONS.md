# Design Decisions

## Source review

- The repository is a React 19 + TypeScript + Vite client application. `package.json` has no server, API client, ORM, or database dependency; there are no migrations or existing database schema files.
- The UI routes cover dashboard, POS, menu, invoices, customers, cashbook, and settings. Content comes from in-file mock arrays and React component state; there are no `fetch`/Axios calls or browser persistence.
- Product data contains name, category, price, tag, and image. The menu UI adds SKU, cost, stock, menu type, and an ingredients array, and allows editing product fields in memory.
- POS/cart/invoice examples establish order type, items, quantity, portion/note snapshots, subtotal, discount, service fee, total, customer, guests, displayed location label, cashier, receipt/order identifiers, status, and payment method.
- Customer examples show name, phone, visits, points, total spend, and membership tier. Visits and spend can be derived from persisted orders; points and tier have no earning, redemption, or upgrade logic in source.
- The cashbook supports incoming/outgoing entries, cash/bank accounts, amounts, categories, counterparty labels, references, date, description, and creator. Sales receipt entries are described as automatically connected to invoices.
- Store settings expose name, phone, service-fee percent, and order notifications. The UI shows a fixed branch label on invoices, cashbook, and menu stock, but no multi-branch administration flow.

## Database choice

Recommend PostgreSQL 13+ for the proposed relational schema. Sales headers, immutable line snapshots, payments, cashbook posting, and inventory adjustments need foreign keys, checks, and transactions. PostgreSQL offers UUID generation, partial indexes, strong constraint support, and straightforward transactional updates. MySQL 8 is also capable, but adopting it would require translating UUID generation and partial indexes; there is no current ORM or database constraint directing either choice.

## Modeling choices

- `store_settings` stores settings for a single store and uses a fixed primary key to enforce the singleton. `orders` represent both the POS order and invoice record. `receipt_code` and `order_number` preserve the two identifiers visible in the UI and are unique across the store; status and timestamps preserve lifecycle history.
- Order lines snapshot names, portions, notes, and prices so later product edits do not rewrite historical invoices. Preventing edits to closed sales remains an application permission/transaction rule. Product/customer/accounting history uses restrictive deletes where appropriate; product references on old lines and customer references on orders can be cleared without losing snapshots.
- Money uses `bigint` whole VND, consistent with all visible values and avoiding floating-point rounding. Percentage rates use `numeric(5,2)`. The order total has a row check; calculating line sums, payment totals, and cashbook postings must happen inside a database transaction in the application.
- Payments are separate rows to preserve payment history and allow partial/multiple tenders, though the current screen only demonstrates a single cash tender. Each payment may link to one cashbook entry; manual cashbook entries have no payment link.
- Product stock is modeled as a movement ledger for the single store; sum signed deltas per product to get current stock. Negative stock is allowed because the UI displays `-2`. Inventory updates should append a movement in the same transaction as any balance-affecting event, and the application should prevent editing/deleting history.
- The `store_settings` row carries the store name, phone, service fee, and notification setting shown in the settings form. Cash accounts and inventory apply across the whole store.
- Customer visit count and total spend should be queried from completed orders, avoiding conflicting aggregate copies. Points and tier remain stored values because the mock screen shows them but source has no loyalty rules.
- Cashbook amount is a positive magnitude and direction is stored separately. Each entry directly references a cash account within the single store.

## Deliberately excluded

- No ingredient catalog or recipe/BOM tables: the UI only displays an always-empty string array and offers no ingredient editing, units, quantities, or preparation consumption logic.
- No raw-material purchasing, supplier, receiving, transfer, or spoilage/variance workflow: purchasing ingredients appears only as a cashbook description/category. It is not linked to structured inventory receiving, and the source does not record shrinkage.
- No user/role/authentication tables: the UI has cashier display names but no account/login/permission behavior. Names are snapshots pending a real staff/auth requirement.
- No tax calculation or tax-rate table: the price detail says tax is included in the displayed sale price, with no configurable tax logic.
- No separate invoice, price list, table/room, promotion, notification-delivery, or loyalty-ledger tables: those screens show labels or placeholders but no corresponding workflows or rules.

## Assumptions and open questions

1. Model one store; order, receipt, and reference identifiers are unique across it, and inventory/cashbook are not separated by branch. Confirm whether support for multiple stores is needed in the future.
2. Treat all current amounts as VND and quantities as individual sellable menu units. Confirm if fractional stock units, foreign currencies, or another locale are required.
3. Customer phone is unique when present. Confirm whether family/shared phone numbers may belong to multiple customer records.
4. Treat a completed/cancelled order as closed and retain closed orders; confirm whether post-close voids/refunds need a formal reason and reversal ledger.
5. The schema supports payment states and multiple tenders, but the UI does not show partial-payment or refund controls. Confirm the intended payment lifecycle before implementing writes.
6. The source has no persistence/backend boundary. This proposal does not implement APIs, database deployment, migrations, or data import. Application transactions and authorization must be designed when a backend is selected.
7. Current mock data contains mismatches (for example a sample invoice line sum may not match its displayed total; mock IDs and settings are not canonical seed data). Do not load those examples as production seed data without reconciliation.
