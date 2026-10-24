import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { createCustomer, getCustomers, type Customer } from "../api/customers";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = () => getCustomers().then((result) => setCustomers(result.customers)).catch((cause) => setError(cause instanceof Error ? cause.message : "Không tải được khách hàng.")).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  const visibleCustomers = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.phone ?? ""}`.toLowerCase().includes(query.toLowerCase())), [customers, query]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const result = await createCustomer({ name, phone: phone || undefined });
      setCustomers((current) => [...current, result.customer].sort((a, b) => a.name.localeCompare(b.name, "vi")));
      setName(""); setPhone("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo khách hàng.");
    } finally { setSaving(false); }
  };

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome">
      <div><span className="eyebrow">THÀNH VIÊN</span><h2>Khách hàng</h2><p>Danh sách khách hàng dùng để quản lý và áp dụng bảng giá riêng.</p></div>
      <strong className="management-count">{customers.length} khách hàng</strong>
    </section>
    <article className="panel"><div className="panel-heading"><div><h3>Thêm khách hàng</h3><p>Nhập tên và số điện thoại nếu có.</p></div></div>
      <form className="customer-create-form" onSubmit={(event) => void submit(event)}>
        <label className="setting-field"><span>Tên khách hàng</span><input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="setting-field"><span>Số điện thoại</span><input maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : "Thêm khách hàng"}</button>
      </form>
    </article>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="management-toolbar"><label className="search-box"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc số điện thoại..." /></label></div>
    <article className="panel orders-panel">
      <div className="panel-heading"><div><h3>Danh sách khách hàng</h3><p>{visibleCustomers.length} kết quả</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>SỐ ĐIỆN THOẠI</th><th>ĐIỂM</th><th>HẠNG</th></tr></thead><tbody>
        {visibleCustomers.map((customer) => <tr key={customer.id}><td><div className="customer-name"><span>{customer.name.slice(0, 2).toUpperCase()}</span><strong>{customer.name}</strong></div></td><td>{customer.phone || "—"}</td><td>{customer.points}</td><td><span className="status done">{customer.tier}</span></td></tr>)}
      </tbody></table>{loading ? <div className="management-empty">Đang tải khách hàng...</div> : !visibleCustomers.length && <div className="management-empty">Chưa có khách hàng phù hợp.</div>}</div>
    </article>
  </div>;
}
