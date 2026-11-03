import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { createCustomer, getCustomerDetail, getCustomers, type Customer, type CustomerInvoice } from "../api/customers";

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")} ₫`;
const invoiceStatus = (status: string) => status === "completed" ? "Hoàn thành" : status === "awaiting_payment" ? "Chờ thanh toán" : status;
const paymentMethodName: Record<string, string> = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", credit: "Công nợ", card: "Thẻ", other: "Khác" };

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const load = () => getCustomers().then((result) => setCustomers(result.customers)).catch((cause) => setError(cause instanceof Error ? cause.message : "Không tải được khách hàng.")).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  const visibleCustomers = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.phone ?? ""}`.toLowerCase().includes(query.toLowerCase())), [customers, query]);
  const openCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerInvoices([]);
    setDetailError("");
    setDetailLoading(true);
    try {
      const result = await getCustomerDetail(customer.id);
      setSelectedCustomer(result.customer);
      setCustomerInvoices(result.invoices);
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : "Không tải được thông tin khách hàng.");
    } finally { setDetailLoading(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const result = await createCustomer({ name, phone: phone || undefined });
      setCustomers((current) => [...current, { ...result.customer, creditVnd: 0 }].sort((a, b) => a.name.localeCompare(b.name, "vi")));
      setName(""); setPhone("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo khách hàng.");
    } finally { setSaving(false); }
  };

  if (selectedCustomer) return <div className="dashboard page-enter">
    <section className="welcome management-welcome customer-detail-welcome">
      <div><button type="button" className="customer-detail-back" onClick={() => { setSelectedCustomer(null); setCustomerInvoices([]); setDetailError(""); }}><Icon name="chevron" size={18} /> Danh sách khách hàng</button><span className="eyebrow">HỒ SƠ KHÁCH HÀNG</span><h2>{selectedCustomer.name}</h2><p>{selectedCustomer.phone || "Chưa có số điện thoại"}</p></div>
      <strong className="customer-credit-total">Công nợ {formatMoney(selectedCustomer.creditVnd)}</strong>
    </section>
    <section className="customer-profile-grid">
      <article className="panel customer-profile-card"><span>Thông tin khách hàng</span><strong>{selectedCustomer.name}</strong><div><span>Số điện thoại</span><b>{selectedCustomer.phone || "—"}</b></div><div><span>Điểm thành viên</span><b>{selectedCustomer.points}</b></div><div><span>Hạng thành viên</span><b>{selectedCustomer.tier}</b></div></article>
      <article className="panel customer-credit-card"><span>Tổng công nợ</span><strong>{formatMoney(selectedCustomer.creditVnd)}</strong><small>Tính từ các khoản công nợ chưa thanh toán</small></article>
    </section>
    <article className="panel orders-panel customer-invoices-panel">
      <div className="panel-heading"><div><h3>Hóa đơn khách hàng</h3><p>{customerInvoices.length} hóa đơn · bao gồm hóa đơn công nợ</p></div></div>
      {detailError && <div className="management-empty" role="alert">{detailError}<button className="text-button" type="button" onClick={() => void openCustomer(selectedCustomer)}>Thử lại</button></div>}
      {detailLoading ? <div className="management-empty" role="status">Đang tải hóa đơn...</div> : !detailError && <div className="table-wrap"><table><thead><tr><th>MÃ HÓA ĐƠN</th><th>NGÀY</th><th>TRẠNG THÁI</th><th>THANH TOÁN</th><th>TỔNG TIỀN</th><th>ĐÃ THANH TOÁN</th><th>CÔNG NỢ</th></tr></thead><tbody>
        {customerInvoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.receiptCode}</strong><small className="customer-invoice-number">{invoice.orderNumber}</small></td><td>{new Date(invoice.orderedAt).toLocaleString("vi-VN")}</td><td><span className={`status ${invoice.creditVnd > 0 ? "waiting" : invoice.status === "completed" ? "done" : ""}`}>{invoice.creditVnd > 0 ? "Còn công nợ" : invoiceStatus(invoice.status)}</span></td><td>{invoice.paymentMethods.map((method) => paymentMethodName[method] ?? method).join(", ") || "—"}</td><td>{formatMoney(invoice.totalVnd)}</td><td>{formatMoney(invoice.paidVnd)}</td><td className={invoice.creditVnd > 0 ? "customer-invoice-debt" : ""}>{formatMoney(invoice.creditVnd)}</td></tr>)}
      </tbody></table>{!customerInvoices.length && <div className="management-empty">Khách hàng chưa có hóa đơn.</div>}</div>}
    </article>
  </div>;

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
      <div className="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>CÔNG NỢ</th></tr></thead><tbody>
        {visibleCustomers.map((customer) => <tr key={customer.id} className="customer-click-row" onClick={() => void openCustomer(customer)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openCustomer(customer); } }} tabIndex={0} role="button" aria-label={`Mở hồ sơ khách hàng ${customer.name}`}><td><div className="customer-name"><span>{customer.name.slice(0, 2).toUpperCase()}</span><strong>{customer.name}</strong></div></td><td className={customer.creditVnd > 0 ? "customer-invoice-debt" : ""}>{formatMoney(customer.creditVnd)}</td></tr>)}
      </tbody></table>{loading ? <div className="management-empty">Đang tải khách hàng...</div> : !visibleCustomers.length && <div className="management-empty">Chưa có khách hàng phù hợp.</div>}</div>
    </article>
  </div>;
}
