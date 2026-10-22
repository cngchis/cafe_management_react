-- Demo catalog copied from src/data/products.ts.
-- Opening balances mirror the menu UI's stockLevels demo values.
-- Safe to rerun: existing SKUs are left unchanged and do not get duplicate movements.

BEGIN;

WITH demo_products (sku, name, category, menu_type, image_url, tag, sale_price_vnd, cost_price_vnd, opening_stock) AS (
    VALUES
        ('SP000131', 'Cà phê sữa đá', 'Cà phê', 'Món thường', 'https://images.unsplash.com/photo-1545731939-9c302d5d27ed?auto=format&fit=crop&w=500&q=85', 'Best Sell', 32000::bigint, 11200::bigint, 0::numeric),
        ('SP000132', 'Bạc xỉu kem muối', 'Cà phê', 'Món thường', 'https://images.unsplash.com/photo-1636875485729-02ec3ec9091c?auto=format&fit=crop&w=500&q=85', 'New', 42000::bigint, 14700::bigint, 2::numeric),
        ('SP000133', 'Latte nóng', 'Cà phê', 'Món thường', 'https://images.unsplash.com/photo-1678569187178-eab3ece6f778?auto=format&fit=crop&w=500&q=85', NULL, 45000::bigint, 15750::bigint, 9::numeric),
        ('SP000134', 'Matcha latte', 'Trà', 'Món thường', 'https://images.unsplash.com/photo-1790354760502-5a64e3cdfa45?auto=format&fit=crop&w=500&q=85', 'Best Sell', 48000::bigint, 16800::bigint, 2::numeric),
        ('SP000135', 'Trà đào cam sả', 'Trà', 'Món thường', 'https://images.unsplash.com/photo-1663869579145-a41cc386e630?auto=format&fit=crop&w=500&q=85', NULL, 45000::bigint, 15750::bigint, -2::numeric),
        ('SP000136', 'Cold brew cam', 'Đá xay', 'Món thường', 'https://images.unsplash.com/photo-1662190680102-d958a06ff6f7?auto=format&fit=crop&w=500&q=85', NULL, 52000::bigint, 18200::bigint, 4::numeric),
        ('SP000137', 'Croissant bơ', 'Bánh ngọt', 'Món thường', 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=500&q=85', NULL, 35000::bigint, 12250::bigint, 0::numeric),
        ('SP000138', 'Tiramisu', 'Bánh ngọt', 'Món thường', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=500&q=85', NULL, 49000::bigint, 17150::bigint, 7::numeric)
), inserted_products AS (
    INSERT INTO products (sku, name, category, menu_type, image_url, tag, sale_price_vnd, cost_price_vnd)
    SELECT sku, name, category, menu_type, image_url, tag, sale_price_vnd, cost_price_vnd
    FROM demo_products
    ON CONFLICT (sku) DO NOTHING
    RETURNING id, sku
)
INSERT INTO inventory_movements (product_id, quantity_delta, reason, note, created_by_name)
SELECT inserted_products.id, demo_products.opening_stock, 'opening_balance', 'Tồn đầu kỳ demo', 'Demo seed'
FROM inserted_products
JOIN demo_products USING (sku)
WHERE demo_products.opening_stock <> 0;

COMMIT;
