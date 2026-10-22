import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { createInventoryCheck, getInventoryChecks, type InventoryCheckHistory, type InventoryCheckProduct } from "../api/inventoryChecks";

const formatQuantity = (quantity: number) => Number(quantity.toFixed(3)).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
const formatDate = (date: string) => new Date(date).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function InventoryCheckPage() {
  const [products, setProducts] = useState<InventoryCheckProduct[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<InventoryCheckHistory[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getInventoryChecks();
      setProducts(data.products);
      setCounts(Object.fromEntries(data.products.map((product) => [product.id, String(Math.max(0, product.stock))])));
      setHistory(data.history);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu kiểm kho.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const changedCount = products.filter((product) => Number(counts[product.id]) !== product.stock).length;
  const countedTotal = products.reduce((sum, product) => sum + (Number(counts[product.id]) || 0), 0);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      await createInventoryCheck({
        note: note.trim() || undefined,
        items: products.map((product) => ({ productId: product.id, countedQuantity: Number(counts[product.id]) })),
      });
      setNote("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu lần kiểm kho.");
    } finally {
      setIsSaving(false);
    }
  };

  return <div className="dashboard page-enter inventory-check-page">
    <section className="welcome management-welcome">
      <div><span className="eyebrow">TỒN KHO</span><h2>Kiểm kho</h2><p>Đếm tồn thực tế và ghi nhận chênh lệch vào lịch sử tồn kho.</p></div>
    </section>

    {error && <p role="alert" className="menu-help">{error}</p>}

    <form className="panel inventory-check-panel" onSubmit={submit}>
      <div className="panel-heading"><div><h3>Kiểm kê món</h3><p>{products.length} món đang hoạt động · {changedCount} món có chênh lệch</p></div></div>
      <div className="inventory-check-list">
        <div className="inventory-check-row inventory-check-header"><span>Món</span><span>Tồn hệ thống</span><span>Tồn thực tế</span><span>Chênh lệch</span></div>
        {isLoading && <div className="management-empty">Đang tải danh sách món...</div>}
        {!isLoading && products.map((product) => {
          const counted = Number(counts[product.id] ?? product.stock);
          const delta = counted - product.stock;
          return <div className="inventory-check-row" key={product.id}>
            <span className="inventory-check-product">{product.image ? <img src={product.image} alt="" /> : <span className="inventory-check-placeholder"><Icon name="coffee" size={16} /></span>}<span><strong>{product.name}</strong><small>{product.sku}</small></span></span>
            <span>{formatQuantity(product.stock)}</span>
            <label className="inventory-count-input"><span className="sr-only">Tồn thực tế của {product.name}</span><input type="number" min="0" max="1000000000" step="0.001" required value={counts[product.id] ?? ""} onChange={(event) => setCounts((current) => ({ ...current, [product.id]: event.target.value }))} /></label>
            <strong className={delta < 0 ? "inventory-delta negative" : delta > 0 ? "inventory-delta positive" : "inventory-delta"}>{delta > 0 ? "+" : ""}{formatQuantity(delta)}</strong>
          </div>;
        })}
        {!isLoading && !products.length && <div className="management-empty">Chưa có món để kiểm kho.</div>}
      </div>
      <div className="inventory-check-footer">
        <label className="setting-field"><span>Ghi chú (không bắt buộc)</span><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Kiểm kê cuối ca" /></label>
        <div className="inventory-check-submit"><span>Tổng tồn thực tế: <strong>{formatQuantity(countedTotal)}</strong></span><button className="primary-button" type="submit" disabled={isLoading || isSaving || !products.length}><Icon name="check" size={17} />{isSaving ? "Đang lưu..." : "Lưu kết quả kiểm kho"}</button></div>
      </div>
    </form>

    <section className="panel inventory-history-panel">
      <div className="panel-heading"><div><h3>Lịch sử kiểm kho</h3><p>20 lần gần nhất</p></div></div>
      {!history.length && !isLoading && <div className="management-empty">Chưa có lần kiểm kho nào.</div>}
      {history.map((check) => <article className="inventory-history-row" key={check.id}>
        <span className="inventory-history-icon"><Icon name="receipt" size={18} /></span>
        <span className="inventory-history-copy"><strong>{check.note || "Kiểm kho"}</strong><small>{formatDate(check.createdAt)} · {check.checkedByName}</small></span>
        <span className="inventory-history-meta">{check.changedItemCount}/{check.itemCount} món lệch <strong>{check.netDelta > 0 ? "+" : ""}{formatQuantity(check.netDelta)}</strong></span>
      </article>)}
    </section>
  </div>;
}
