# ERD

```mermaid
erDiagram
    CUSTOMERS o|--o{ ORDERS : places
    ORDERS ||--o{ ORDER_ITEMS : contains
    PRODUCTS o|--o{ ORDER_ITEMS : sold_as
    ORDERS ||--o{ PAYMENTS : paid_by
    CASH_ACCOUNTS ||--o{ CASHBOOK_ENTRIES : posts_to
    PAYMENTS o|--o| CASHBOOK_ENTRIES : may_create
    PRODUCTS ||--o{ INVENTORY_MOVEMENTS : changes

    STORE_SETTINGS {
        smallint id PK
        text store_name
        text phone
        numeric service_fee_percent
        boolean order_notifications_enabled
    }
    PRODUCTS {
        uuid id PK
        text sku UK
        text name
        text category
        bigint sale_price_vnd
        bigint cost_price_vnd
    }
    CUSTOMERS {
        uuid id PK
        text name
        text phone UK
        integer points_balance
        text membership_tier
    }
    ORDERS {
        uuid id PK
        uuid customer_id FK
        text receipt_code
        text order_number
        text status
        text order_type
        bigint total_vnd
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        text product_name_snapshot
        integer quantity
        bigint unit_price_vnd
        bigint line_total_vnd
    }
    PAYMENTS {
        uuid id PK
        uuid order_id FK
        bigint amount_vnd
        text method
        text status
    }
    CASH_ACCOUNTS {
        uuid id PK
        text name
        text account_type
    }
    CASHBOOK_ENTRIES {
        uuid id PK
        uuid cash_account_id FK
        uuid payment_id FK
        text direction
        bigint amount_vnd
    }
    INVENTORY_MOVEMENTS {
        uuid id PK
        uuid product_id FK
        numeric quantity_delta
        text reason
    }
```

## Relationship notes

- `store_settings` contains the single store's settings. Orders, cash accounts, cashbook entries, and inventory are scoped to that store; order and reference identifiers are unique across it.
- An order can be walk-in (no customer) or linked to one customer. It can have multiple line snapshots and payment attempts/settlements. The schema preserves snapshots, while preventing edits to closed sales remains an application permission/transaction rule.
- An order line may retain its name and price snapshot after a product is removed; its optional product reference is cleared on product deletion.
- A payment can produce at most one linked cashbook entry. The link is optional because the UI does not show reconciliation for every payment. Cashbook entries can also be manual receipts or expenses.
- Inventory movements are signed product quantity changes. Current stock is the sum of movements by product; negative totals are allowed because the UI displays negative stock.
- Customer visit count and spend are derived from orders rather than duplicated counters. The visible points balance and membership tier are stored, but the app does not implement their earning/redemption rules.

The schema deliberately has no ingredient, recipe, supplier, or waste tables. The UI exposes an ingredients display backed by an always-empty array, but does not edit ingredient quantities, receive stock, or record spoilage. See [design decisions](DESIGN_DECISIONS.md).
