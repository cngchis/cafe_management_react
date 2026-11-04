import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getProductPage } from "../api/products";
import { formatMoney, type Product } from "../data/products";
import { Icon } from "./Icon";

function EstimateProductRow({ product, onSelect }: { product: Product; onSelect: (product: Product) => void }) {
  return <button type="button" className="estimate-product-row" onClick={() => onSelect(product)}>
    <span className="estimate-product-image">{product.image ? <img src={product.image} alt="" /> : <Icon name="coffee" size={22} />}</span>
    <span className="estimate-product-copy"><strong>{product.name}</strong><small>{product.sku} · {product.category}</small><b>{formatMoney(product.price)}</b></span>
    <span className="estimate-product-add-indicator" aria-label="Thêm món"><Icon name="plus" size={21} /></span>
  </button>;
}

export function EstimateProductPicker({ customerId, onAdd }: { customerId?: string; onAdd: (product: Product) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const loadingRef = useRef(false);
  const feedbackTimer = useRef<number | undefined>(undefined);

  const loadPage = useCallback(async (reset: boolean) => {
    if (loadingRef.current || (!reset && !hasMore)) return;
    const currentRequest = ++requestId.current;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const nextOffset = reset ? 0 : offset;
      const page = await getProductPage({ customerId, query, offset: nextOffset, limit: 8 });
      if (currentRequest !== requestId.current) return;
      setProducts((current) => reset ? page.products : [...current, ...page.products]);
      setOffset(nextOffset + page.products.length);
      setHasMore(page.hasMore);
    } catch (cause) {
      if (currentRequest === requestId.current) setError(cause instanceof Error ? cause.message : "Không tải được danh sách món.");
    } finally {
      if (currentRequest === requestId.current) { setLoading(false); loadingRef.current = false; }
    }
  }, [customerId, hasMore, offset, query]);

  useEffect(() => {
    if (!pickerOpen) return;
    requestId.current += 1;
    loadingRef.current = false;
    setProducts([]); setOffset(0); setHasMore(true); setLoading(false);
    if (listRef.current) listRef.current.scrollTop = 0;
    const timer = window.setTimeout(() => void loadPage(true), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  // Reset and fetch the first page whenever the picker opens or its search changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, pickerOpen, query]);

  useEffect(() => {
    const node = sentinel.current;
    const root = listRef.current;
    if (!pickerOpen || !node || !root || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadPage(false); }, { root, rootMargin: "40px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadPage, pickerOpen]);

  const selectProduct = async (product: Product) => {
    setError("");
    try {
      await onAdd(product);
      setFeedbackKey((current) => current + 1);
      setFeedbackVisible(true);
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => setFeedbackVisible(false), 850);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể thêm món vào hóa đơn."); }
  };

  return <>
    <button type="button" className="estimate-product-search-trigger" onClick={() => setPickerOpen(true)}><Icon name="search" size={18} /><span>Tìm món để thêm vào hóa đơn...</span></button>
    {pickerOpen && createPortal(<section className="estimate-product-screen" role="dialog" aria-modal="true" aria-label="Chọn sản phẩm">
      <header className="estimate-product-screen-header">
        <button type="button" className="estimate-product-back" onClick={() => setPickerOpen(false)} aria-label="Quay lại hóa đơn"><Icon name="chevron" size={25} /></button>
        <label className="estimate-product-search"><Icon name="search" size={18} /><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, mã hàng..." aria-label="Tìm sản phẩm" /></label>
      </header>
      <div className="estimate-product-list estimate-product-screen-list" ref={listRef}>
        {products.map((product) => <EstimateProductRow key={product.id} product={product} onSelect={(item) => void selectProduct(item)} />)}
        {loading && <p className="estimate-product-message" role="status">Đang tải sản phẩm...</p>}
        {!loading && !products.length && !error && <p className="estimate-product-message">Không tìm thấy sản phẩm.</p>}
        {error && <p className="estimate-product-message" role="alert">{error}<button type="button" onClick={() => void loadPage(products.length === 0)}>Thử lại</button></p>}
        <div ref={sentinel} aria-hidden="true" />
      </div>
      {feedbackVisible && <div key={feedbackKey} className="estimate-product-added-feedback" role="status" aria-live="polite"><span><Icon name="check" size={34} /></span><strong>Đã thêm vào hóa đơn</strong></div>}
    </section>, document.body)}
  </>;
}
