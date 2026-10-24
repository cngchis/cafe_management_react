import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPurchase, getPurchases, type PurchaseRecord } from "../api/moreOperations";
import { getProducts } from "../api/products";
import type { Product } from "../data/products";
import { formatMoney } from "../data/products";

type PurchaseLine = { productId: string; quantity: string; unitCostVnd: string };
const emptyLine = (): PurchaseLine => ({ productId: "", quantity: "1", unitCostVnd: "0" });

export function PurchasesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [receipts, setReceipts] = useState<PurchaseRecord[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([emptyLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [catalog, history] = await Promise.all([getProducts(), getPurchases()]);
      setProducts(catalog); setReceipts(history.receipts); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu nhập hàng."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const total = useMemo(() => lines.reduce((sum, line) => sum + Math.round((Number(line.quantity) || 0) * (Number(line.unitCostVnd) || 0)), 0), [lines]);
  const usedIds = lines.map((line) => line.productId).filter(Boolean);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await createPurchase({ supplierName: supplierName.trim() || undefined, note: note.trim() || undefined,
        items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitCostVnd: Number(line.unitCostVnd) })) });
      setLines([emptyLine()]); setSupplierName(""); setNote(""); setNotice("Đã nhập hàng và cập nhật tồn kho."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu phiếu nhập."); }
    finally { setSaving(false); }
  };

  const updateLine = (index: number, changes: Partial<PurchaseLine>) => setLines((current) => current.map((line, row) => row === index ? { ...line, ...changes } : line));

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome"><div><span className="eyebrow">KHO HÀNG</span><h2>Nhập hàng</h2><p>Ghi phiếu nhập, tăng tồn kho và cập nhật giá vốn gần nhất của món.</p></div></section>
    {error && <p className="menu-help" role="alert">{error}</p>}{notice && <p className="menu-help" role="status">{notice}</p>}
    <form className="panel purchase-form" onSubmit={submit}>
      <div className="panel-heading"><div><h3>Phiếu nhập mới</h3><p>Phiếu nhập chỉ ghi nhận hàng nhận vào kho; thanh toán nhà cung cấp chưa được ghi trong sổ quỹ.</p></div></div>
      <div className="purchase-fields"><label className="setting-field"><span>Nhà cung cấp (tùy chọn)</span><input maxLength={200} value={supplierName} onChange={(event) => setSupplierName(event.target.value)} /></label><label className="setting-field"><span>Ghi chú</span><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label></div>
      <div className="purchase-lines">
        {lines.map((line, index) => <div className="purchase-line" key={index}>
          <label className="setting-field"><span>Món</span><select required value={line.productId} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); updateLine(index, { productId: event.target.value, unitCostVnd: String(product?.cost ?? 0) }); }}><option value="">Chọn món</option>{products.filter((item) => !usedIds.includes(item.id) || item.id === line.productId).map((product) => <option key={product.id} value={product.id}>{product.name} · tồn {product.stock}</option>)}</select></label>
          <label className="setting-field"><span>Số lượng</span><input required type="number" min="0.001" max="10000000" step="0.001" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></label>
          <label className="setting-field"><span>Giá vốn / đơn vị (VND)</span><input required type="number" min="0" step="1" value={line.unitCostVnd} onChange={(event) => updateLine(index, { unitCostVnd: event.target.value })} /></label>
          <strong className="purchase-line-total">{formatMoney(Math.round((Number(line.quantity) || 0) * (Number(line.unitCostVnd) || 0)))}</strong>
          {lines.length > 1 && <button className="text-button" type="button" aria-label="Bỏ dòng hàng" onClick={() => setLines((current) => current.filter((_, row) => row !== index))}>Bỏ</button>}
        </div>)}
        {!products.length && !loading && <p className="management-empty">Cần tạo món trước khi nhập hàng.</p>}
        <button className="text-button" type="button" disabled={usedIds.length >= products.length} onClick={() => setLines((current) => [...current, emptyLine()])}>+ Thêm mặt hàng</button>
      </div>
      <div className="purchase-footer"><strong>Tổng giá trị hàng nhập: {formatMoney(total)}</strong><button className="primary-button" type="submit" disabled={saving || loading || !products.length || lines.some((line) => !line.productId)}>{saving ? "Đang lưu…" : "Lưu phiếu nhập"}</button></div>
    </form>
    <section className="panel purchase-history"><div className="panel-heading"><div><h3>Lịch sử nhập hàng</h3><p>100 phiếu gần nhất</p></div></div>
      {loading && <p className="management-empty">Đang tải phiếu…</p>}{!loading && receipts.length === 0 && <p className="management-empty">Chưa có phiếu nhập.</p>}
      {receipts.map((receipt) => <article className="purchase-history-row" key={receipt.id}><span><strong>{receipt.receiptNumber}</strong><small>{new Date(receipt.receivedAt).toLocaleString("vi-VN")} · {receipt.supplierName || "Chưa ghi nhà cung cấp"}</small></span><span>{receipt.itemCount} món</span><strong>{formatMoney(receipt.totalVnd)}</strong></article>)}
    </section>
  </div>;
}
