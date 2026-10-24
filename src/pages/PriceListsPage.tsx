import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPriceList, deactivatePriceList, getPriceLists, getPriceListTargets, type CustomerTarget, type PriceListRecord, type ProductTarget } from "../api/moreOperations";
import { formatMoney } from "../data/products";

function localDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function PriceListsPage() {
  const [products, setProducts] = useState<ProductTarget[]>([]);
  const [customers, setCustomers] = useState<CustomerTarget[]>([]);
  const [lists, setLists] = useState<PriceListRecord[]>([]);
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState(() => localDateTime(new Date()));
  const [endsAt, setEndsAt] = useState("");
  const [allCustomers, setAllCustomers] = useState(true);
  const [customerIds, setCustomerIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [targets, result] = await Promise.all([getPriceListTargets(), getPriceLists()]);
      setProducts(targets.products); setCustomers(targets.customers); setLists(result.lists);
      setPrices((current) => Object.fromEntries(targets.products.map((product) => [product.id, current[product.id] ?? String(product.price)])));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được bảng giá."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await createPriceList({
        name: name.trim(), startsAt: new Date(startsAt).toISOString(), endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        appliesToAllCustomers: allCustomers, customerIds: allCustomers ? [] : customerIds,
        items: productIds.map((productId) => ({ productId, salePriceVnd: Number(prices[productId]) })),
      });
      setName(""); setProductIds([]); setNotice("Đã tạo bảng giá."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo bảng giá."); }
    finally { setSaving(false); }
  };

  const stopList = async (id: string) => {
    setError("");
    try { await deactivatePriceList(id); setNotice("Đã ngừng áp dụng bảng giá."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể ngừng bảng giá."); }
  };

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome"><div><span className="eyebrow">THỰC ĐƠN</span><h2>Thiết lập giá</h2><p>Tạo bảng giá theo thời gian và phạm vi khách hàng.</p></div></section>
    {error && <p className="menu-help" role="alert">{error}</p>}{notice && <p className="menu-help" role="status">{notice}</p>}
    <section className="panel price-base-card"><span className="eyebrow">BẢNG GIÁ CHUNG · MẶC ĐỊNH</span><h3>Bảng giá gốc của hệ thống</h3><p>Giá bán trên từng món · áp dụng mọi thời điểm, mọi khách hàng và toàn bộ thực đơn.</p></section>
    <form className="panel price-list-form" onSubmit={submit}>
      <div className="panel-heading"><div><h3>Tạo bảng giá riêng</h3><p>Giá riêng chỉ thay thế giá gốc cho những món được chọn.</p></div></div>
      <div className="price-form-fields">
        <label className="setting-field"><span>Tên bảng giá</span><input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Giá khách thành viên" /></label>
        <label className="setting-field"><span>Bắt đầu áp dụng</span><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label className="setting-field"><span>Kết thúc (không bắt buộc)</span><input type="datetime-local" min={startsAt} value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
      </div>
      <div className="price-customer-scope"><strong>Phạm vi khách hàng</strong><label><input type="radio" checked={allCustomers} onChange={() => setAllCustomers(true)} /> Tất cả khách hàng</label><label><input type="radio" checked={!allCustomers} onChange={() => setAllCustomers(false)} /> Chỉ khách hàng được chọn</label></div>
      {!allCustomers && <div className="price-customer-list">{customers.map((customer) => <label key={customer.id}><input type="checkbox" checked={customerIds.includes(customer.id)} onChange={(event) => setCustomerIds((current) => event.target.checked ? [...current, customer.id] : current.filter((id) => id !== customer.id))} />{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</label>)}{customers.length === 0 && <p className="management-empty">Chưa có khách hàng trong database để chọn.</p>}</div>}
      <div className="price-product-picks"><h4>Chọn món và giá áp dụng</h4>{products.map((product) => <div className="price-product-row" key={product.id}><label><input type="checkbox" checked={productIds.includes(product.id)} onChange={(event) => setProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /><span><strong>{product.name}</strong><small>{product.category} · giá gốc {formatMoney(product.price)}</small></span></label>{productIds.includes(product.id) && <input aria-label={`Giá ${product.name}`} type="number" min="0" step="1" required value={prices[product.id] ?? product.price} onChange={(event) => setPrices((current) => ({ ...current, [product.id]: event.target.value }))} />}</div>)}{products.length === 0 && !loading && <p className="management-empty">Chưa có món đang hoạt động.</p>}</div>
      <div className="settings-footer"><span role="status" /> <button className="primary-button" type="submit" disabled={saving || loading || productIds.length === 0 || (!allCustomers && customerIds.length === 0)}>{saving ? "Đang lưu…" : "Tạo bảng giá"}</button></div>
    </form>
    <section className="panel price-list-history"><div className="panel-heading"><div><h3>Bảng giá đã tạo</h3><p>{lists.length} bảng giá · bảng chung luôn dùng giá gốc của món.</p></div></div>
      {loading && <p className="management-empty">Đang tải…</p>}{!loading && !lists.length && <p className="management-empty">Chưa có bảng giá riêng.</p>}
      {lists.map((list) => <article className="price-list-row" key={list.id}><span><strong>{list.name}</strong><small>{new Date(list.startsAt).toLocaleString("vi-VN")} — {list.endsAt ? new Date(list.endsAt).toLocaleString("vi-VN") : "Không thời hạn"}</small></span><span>{list.appliesToAllCustomers ? "Tất cả khách" : `${list.customerCount} khách`} · {list.productCount} món</span><span className={list.isActive ? "status done" : "status"}>{list.isActive ? "Đang bật" : "Đã tắt"}</span>{list.isActive && <button className="text-button" type="button" onClick={() => void stopList(list.id)}>Ngừng áp dụng</button>}</article>)}
    </section>
  </div>;
}
