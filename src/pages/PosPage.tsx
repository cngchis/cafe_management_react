import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/Icon";
import { CartPanel } from "../components/CartPanel";
import { formatMoney, type Product } from "../data/products";
import { getProducts } from "../api/products";
import { createOrder } from "../api/orders";

type Cart = Record<string, number>;

export function PosPage() {
  const [category, setCategory] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const categories = ["Tất cả", "Cà phê", "Trà", "Đá xay", "Bánh ngọt"];
  const visibleProducts = products.filter((item) => (category === "Tất cả" || item.category === category) && item.name.toLowerCase().includes(query.toLowerCase()));
  const cartItems = products.filter((item) => cart[item.id]).map((item) => ({ ...item, quantity: cart[item.id] }));
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const updateCart = (id: string, delta: number) => setCart((current) => {
    const next = Math.max(0, (current[id] || 0) + delta);
    const updated = { ...current, [id]: next };
    if (!next) delete updated[id];
    return updated;
  });
  const completeOrder = async (orderType: "dine_in" | "takeaway" | "delivery", note: string, idempotencyKey: string) => {
    const order = await createOrder({
      items: cartItems.map(({ id, quantity }) => ({ productId: id, quantity })),
      orderType,
      note,
    }, idempotencyKey);
    setCart({});
    void getProducts().then(setProducts).catch(() => undefined);
    return order.orderNumber;
  };

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((error) => setCatalogError(error instanceof Error ? error.message : "Không tải được thực đơn."))
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    if (!cartOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cartOpen]);

  return <div className="pos-layout page-enter">
    <section className="catalog">
      <div className="catalog-sticky">
        <div className="pos-heading"><div><h2 className="eyebrow">THỰC ĐƠN</h2><p>Chọn món để thêm vào đơn hàng</p></div><div className="pos-actions"><label className="search-box"><Icon name="search" size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm món..." /></label></div></div>
        <div className="category-tabs">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      </div>
      {catalogError && <div className="empty-state" role="alert"><strong>{catalogError}</strong></div>}
      {catalogLoading && <div className="empty-state" role="status">Đang tải thực đơn...</div>}
      <div className="product-grid">
        {visibleProducts.map((product) => <article className="product-card" key={product.id} onClick={() => updateCart(product.id, 1)}>
          <div className="product-image"><img src={product.image} alt={product.name} />{product.tag && <span>{product.tag}</span>}<button aria-label={`Thêm ${product.name}`}><Icon name="plus" /></button></div>
          <div className="product-info"><span>{product.category}</span><h3>{product.name}</h3><strong>{formatMoney(product.price)}</strong></div>
        </article>)}
      </div>
      {!catalogLoading && !catalogError && !visibleProducts.length && <div className="empty-state"><Icon name="search" size={28} /><strong>Không tìm thấy món</strong><span>Thử tìm bằng từ khóa khác</span></div>}
    </section>
    {createPortal(<>
      <button className="cart-toggle" aria-label={`Giỏ hàng, ${cartCount} món`} aria-controls="cart-panel" aria-expanded={cartOpen} onClick={() => setCartOpen(true)}><Icon name="cart" size={22} /><b className="cart-count">{cartCount}</b></button>
      {cartOpen && <div className="cart-overlay"><button className="cart-backdrop" type="button" aria-label="Đóng giỏ hàng" onClick={() => setCartOpen(false)} /><CartPanel items={cartItems} onUpdateCart={updateCart} onClearCart={() => setCart({})} onClose={() => setCartOpen(false)} onComplete={completeOrder} /></div>}
    </>, document.body)}
  </div>;
}
