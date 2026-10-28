import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { Icon } from "../components/Icon";
import { CartPanel } from "../components/CartPanel";
import { formatMoney, type Product } from "../data/products";
import { getProducts } from "../api/products";
import { cancelOrder, createOrder, getOrder, getOrders, payOrder, type OrderDetailRecord, type OrderRecord } from "../api/orders";
import { getPriceListTargets, type CustomerTarget } from "../api/moreOperations";
import { createCustomer } from "../api/customers";
import { getBankAccounts, type BankAccount } from "../api/cashbook";

type Cart = Record<string, number>;

export function PosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const estimateId = searchParams.get("estimateId");
  const [category, setCategory] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<{ title: string; detail: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<CustomerTarget[]>([]);
  const [defaultBankAccount, setDefaultBankAccount] = useState<BankAccount | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [estimate, setEstimate] = useState<OrderDetailRecord | null>(null);
  const [estimateError, setEstimateError] = useState("");
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateListOpen, setEstimateListOpen] = useState(false);
  const [estimateOrders, setEstimateOrders] = useState<OrderRecord[]>([]);
  const [estimateListLoading, setEstimateListLoading] = useState(false);
  const [estimateListError, setEstimateListError] = useState("");
  const categories = [
    "Tất cả",
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ];
  const visibleProducts = products.filter((item) => (category === "Tất cả" || item.category === category) && item.name.toLowerCase().includes(query.toLowerCase()));
  const cartItems = products.filter((item) => cart[item.id]).map((item) => ({ ...item, quantity: cart[item.id] }));
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const updateCart = (id: string, delta: number) => setCart((current) => {
    const next = Math.max(0, (current[id] || 0) + delta);
    const updated = { ...current, [id]: next };
    if (!next) delete updated[id];
    return updated;
  });
  const completeOrder = async (orderType: "dine_in" | "takeaway" | "delivery", note: string, idempotencyKey: string, payment: { mode?: "payment" | "estimate"; amountReceivedVnd: number; paymentMethod: "cash" | "bank_transfer"; customerName: string; customerId?: string; discountVnd: number; transferReference?: string; bankAccountId?: string }) => {
    const order = await createOrder({
      items: cartItems.map(({ id, quantity }) => ({ productId: id, quantity })),
      orderType,
      note,
      ...payment,
    }, idempotencyKey);
    setCart({});
    setCartOpen(false);
    setSuccessNotice({ title: payment.mode === "estimate" ? "Đã lưu hóa đơn tạm tính" : "Thanh toán thành công", detail: `Đơn ${order.orderNumber} đã được lưu.` });
    void getProducts().then(setProducts).catch(() => undefined);
    return order.orderNumber;
  };

  const settleEstimate = async (id: string, input: { amountReceivedVnd: number; paymentMethod: "cash" | "bank_transfer"; transferReference?: string; bankAccountId?: string }, idempotencyKey: string) => {
    const orderNumber = await payOrder(id, input, idempotencyKey);
    setCartOpen(false);
    navigate("/pos");
    setSuccessNotice({ title: "Thanh toán thành công", detail: `Đơn ${orderNumber} đã được thanh toán.` });
    return orderNumber;
  };

  useEffect(() => {
    if (!successNotice) return;
    const timeout = window.setTimeout(() => setSuccessNotice(null), 900);
    return () => window.clearTimeout(timeout);
  }, [successNotice]);

  const deleteEstimate = async (id: string) => {
    await cancelOrder(id);
    setCartOpen(false);
    navigate("/pos");
  };

  const openEstimateList = async () => {
    setEstimateListOpen(true);
    setEstimateListLoading(true);
    setEstimateListError("");
    try {
      setEstimateOrders((await getOrders()).filter((order) => order.status === "awaiting_payment"));
    } catch (error) {
      setEstimateListError(error instanceof Error ? error.message : "Không tải được danh sách tạm tính.");
    } finally {
      setEstimateListLoading(false);
    }
  };

  useEffect(() => {
    if (!estimateId) { setEstimate(null); setEstimateError(""); return; }
    setCartOpen(true);
    setEstimateLoading(true);
    setEstimateError("");
    getOrder(estimateId).then((order) => {
      if (order.status !== "awaiting_payment") throw new Error("Đơn này không còn ở trạng thái chờ thanh toán.");
      setEstimate(order);
    }).catch((error) => setEstimateError(error instanceof Error ? error.message : "Không tải được đơn tạm tính."))
      .finally(() => setEstimateLoading(false));
  }, [estimateId]);

  useEffect(() => {
    getPriceListTargets().then(({ customers: rows }) => setCustomers(rows)).catch(() => undefined);
    getBankAccounts().then((accounts) => setDefaultBankAccount(accounts.find((item) => item.isDefault) ?? null)).catch(() => setDefaultBankAccount(null));
  }, []);

  useEffect(() => {
    setCatalogLoading(true);
    getProducts(customerId || undefined)
      .then(setProducts)
      .catch((error) => setCatalogError(error instanceof Error ? error.message : "Không tải được thực đơn."))
      .finally(() => setCatalogLoading(false));
  }, [customerId]);

  useEffect(() => {
    if (!cartOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".transfer-qr-layer")) {
        if (estimateId) navigate("/pos");
        else setCartOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cartOpen, estimateId, navigate]);

  useEffect(() => {
    if (!estimateListOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setEstimateListOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [estimateListOpen]);

  return <div className="pos-layout page-enter">
    <section className="catalog">
      <div className="catalog-sticky">
        <div className="pos-heading"><div><h2 className="eyebrow">THỰC ĐƠN</h2><p>Chọn món để thêm vào đơn hàng</p></div><div className="pos-actions"><label className="search-box"><Icon name="search" size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm món..." /></label><button type="button" className="pos-estimates-button" onClick={() => void openEstimateList()}><Icon name="receipt" size={17} /><span>Đơn tạm tính</span></button></div></div>
        <div className="category-tabs">
          {categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
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
    {estimateListOpen && createPortal(<div className="estimate-list-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setEstimateListOpen(false); }}>
      <section className="estimate-list-dialog" role="dialog" aria-modal="true" aria-labelledby="estimate-list-title">
        <header><div><h2 id="estimate-list-title">Đơn tạm tính</h2><p>Chọn đơn để mở lại và tiếp tục thanh toán</p></div><button type="button" className="icon-button" onClick={() => setEstimateListOpen(false)} aria-label="Đóng danh sách"><Icon name="close" size={18} /></button></header>
        {estimateListLoading && <p className="estimate-list-message" role="status">Đang tải đơn tạm tính...</p>}
        {estimateListError && <div className="estimate-list-message" role="alert"><p>{estimateListError}</p><button type="button" className="text-button" onClick={() => void openEstimateList()}>Thử lại</button></div>}
        {!estimateListLoading && !estimateListError && !estimateOrders.length && <p className="estimate-list-message">Chưa có đơn tạm tính nào.</p>}
        {!estimateListLoading && !estimateListError && estimateOrders.map((order) => <button type="button" className="estimate-list-row" key={order.id} onClick={() => { setEstimateListOpen(false); navigate(`/pos?estimateId=${encodeURIComponent(order.id)}`); }}><span><strong>{order.orderNumber}</strong><small>{new Date(order.orderedAt).toLocaleString("vi-VN")} · {order.orderType}</small></span><strong>{formatMoney(order.totalVnd)}</strong></button>)}
      </section>
    </div>, document.body)}
    {createPortal(<>
      <button className="cart-toggle" aria-label={`Giỏ hàng, ${cartCount} món`} aria-controls="cart-panel" aria-expanded={cartOpen} onClick={() => setCartOpen(true)}><Icon name="cart" size={22} /><b className="cart-count">{cartCount}</b></button>
      {successNotice && <div key={`${successNotice.title}-${successNotice.detail}`} className="pos-success-notice" role="status" aria-live="polite"><span className="pos-success-icon"><Icon name="check" size={22} /></span><span><strong>{successNotice.title}</strong><small>{successNotice.detail}</small></span></div>}
      {(cartOpen || Boolean(estimateId)) && <div className="cart-overlay">{!estimateId && <button className="cart-backdrop" type="button" aria-label="Đóng giỏ hàng" onClick={() => setCartOpen(false)} />}<CartPanel items={estimateId ? [] : cartItems} customers={customers} customerId={customerId} bankAccount={defaultBankAccount} estimate={estimate} estimateLoading={estimateLoading} estimateError={estimateError} onCustomerChange={setCustomerId} onCustomerCreated={(customer) => setCustomers((current) => [...current, customer].sort((a, b) => a.name.localeCompare(b.name, "vi")))} onUpdateCart={updateCart} onClearCart={() => setCart({})} onClose={() => { if (estimateId) { setCartOpen(false); navigate("/pos"); } else setCartOpen(false); }} onComplete={completeOrder} onPayEstimate={settleEstimate} onDeleteEstimate={deleteEstimate} /></div>}
    </>, document.body)}
  </div>;
}
