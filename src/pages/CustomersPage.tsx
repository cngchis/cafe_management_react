import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { collectOrderCredit, getOrder } from "../api/orders";
import { createCustomer, getCustomerDetail, getCustomers, type Customer, type CustomerInvoice } from "../api/customers";
import { InvoiceDetail, type Invoice } from "../components/InvoiceDetail";

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")} ₫`;
const invoiceStatus = (status: string) => status === "completed" ? "Hoàn thành" : status === "awaiting_payment" ? "Chờ thanh toán" : status === "cancelled" ? "Đã hủy" : status;
const paymentMethodName: Record<string, string> = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", credit: "Công nợ", card: "Thẻ", other: "Khác" };

export function CustomersPage() {
  const navigate = useNavigate();
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
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceRow, setSelectedInvoiceRow] = useState<CustomerInvoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
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
  const openInvoice = async (invoiceRow: CustomerInvoice) => {
    setSelectedInvoiceRow(invoiceRow);
    setSelectedInvoice(null);
    setInvoiceError("");
    setInvoiceLoading(true);
    try {
      const order = await getOrder(invoiceRow.id);
      const date = new Date(order.orderedAt);
      const paymentNames = invoiceRow.paymentMethods.map((method) => paymentMethodName[method] ?? method);
      setSelectedInvoice({
        id: order.receiptCode,
        recordId: order.id,
        date: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
        time: date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        customer: order.customerNameSnapshot || selectedCustomer?.name || "Khách lẻ",
        total: order.totalVnd,
        subtotal: order.subtotalVnd,
        serviceFee: order.serviceFeeVnd,
        paidAmount: order.paidAmountVnd,
        creditAmount: invoiceRow.creditVnd,
        discount: order.discountVnd,
        status: order.status === "completed" ? "Hoàn thành" : order.status === "awaiting_payment" ? "Chờ thanh toán" : "Đã hủy",
        paymentMethod: paymentNames.join(", ") || "Chưa thanh toán",
        orderType: order.serviceLocation || order.orderType,
        orderNumber: order.orderNumber,
        guests: order.guestCount,
        priceList: "Bảng giá chung",
        branch: "Chi nhánh trung tâm",
        cashier: order.cashierName || "—",
        orderedAt: order.orderedAt,
        items: order.items.map((item) => ({ name: item.name, portion: item.portion || "Phần", note: item.note || "", quantity: item.quantity, unitPrice: item.unitPriceVnd })),
      });
    } catch (cause) {
      setInvoiceError(cause instanceof Error ? cause.message : "Không tải được chi tiết hóa đơn.");
    } finally { setInvoiceLoading(false); }
  };
  const collectDebt = async (orderId: string) => {
    const amount = await collectOrderCredit(orderId);
    setSelectedInvoice((current) => current?.recordId === orderId ? {
      ...current,
      creditAmount: 0,
      paidAmount: (current.paidAmount ?? 0) + amount,
      paymentMethod: current.paymentMethod === "Chưa thanh toán" ? "Tiền mặt" : `${current.paymentMethod}, Tiền mặt`,
    } : current);
    setCustomerInvoices((current) => current.map((invoice) => invoice.id === orderId ? {
      ...invoice,
      creditVnd: 0,
      paidVnd: invoice.paidVnd + amount,
      paymentMethods: [...new Set([...invoice.paymentMethods, "cash"])],
    } : invoice));
    setSelectedCustomer((current) => current ? { ...current, creditVnd: Math.max(0, current.creditVnd - amount) } : current);
    setCustomers((current) => current.map((customer) => customer.id === selectedCustomer?.id
      ? { ...customer, creditVnd: Math.max(0, customer.creditVnd - amount) }
      : customer));
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

  if (selectedInvoice) return <InvoiceDetail invoice={selectedInvoice} onBack={() => { setSelectedInvoice(null); setSelectedInvoiceRow(null); }} canCancel={false} onCancel={async () => undefined} onResume={(id) => navigate(`/pos?estimateId=${encodeURIComponent(id)}`)} onCollectDebt={collectDebt} />;
  if (selectedInvoiceRow) return <div className="invoice-detail-page page-enter"><nav className="invoice-detail-nav" aria-label="Điều hướng chi tiết hóa đơn"><button className="invoice-back" aria-label="Quay lại khách hàng" onClick={() => { setSelectedInvoiceRow(null); setInvoiceError(""); }}><Icon name="chevron" size={28} /></button></nav><section className="invoice-detail-card" role={invoiceError ? "alert" : "status"}>{invoiceLoading ? "Đang tải chi tiết hóa đơn..." : <>{invoiceError}<button className="text-button" type="button" onClick={() => void openInvoice(selectedInvoiceRow)}>Thử lại</button></>}</section></div>;

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
      {detailLoading ? <div className="management-empty" role="status">Đang tải hóa đơn...</div> : !detailError && <div className="table-wrap"><table className="customer-invoices-table"><thead><tr><th>MÃ HÓA ĐƠN</th><th>TỔNG TIỀN</th><th>TRẠNG THÁI</th></tr></thead><tbody>
        {customerInvoices.map((invoice) => <tr key={invoice.id} className="customer-click-row" onClick={() => void openInvoice(invoice)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openInvoice(invoice); } }} tabIndex={0} role="button" aria-label={`Mở hóa đơn ${invoice.receiptCode}`}><td data-label="Mã hóa đơn"><strong>{invoice.receiptCode}</strong></td><td data-label="Tổng tiền">{formatMoney(invoice.totalVnd)}</td><td data-label="Trạng thái"><span className={`status ${invoice.creditVnd > 0 ? "waiting" : invoice.status === "completed" ? "done" : ""}`}>{invoice.creditVnd > 0 ? "Còn công nợ" : invoiceStatus(invoice.status)}</span></td></tr>)}
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
      <div className="table-wrap"><table className="customer-list-table"><thead><tr><th>KHÁCH HÀNG</th><th>CÔNG NỢ</th></tr></thead><tbody>
        {visibleCustomers.map((customer) => <tr key={customer.id} className="customer-click-row" onClick={() => void openCustomer(customer)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openCustomer(customer); } }} tabIndex={0} role="button" aria-label={`Mở hồ sơ khách hàng ${customer.name}`}><td data-label="Khách hàng"><div className="customer-name"><span>{customer.name.slice(0, 2).toUpperCase()}</span><strong>{customer.name}</strong></div></td><td data-label="Công nợ" className={customer.creditVnd > 0 ? "customer-invoice-debt" : ""}>{formatMoney(customer.creditVnd)}</td></tr>)}
      </tbody></table>{loading ? <div className="management-empty">Đang tải khách hàng...</div> : !visibleCustomers.length && <div className="management-empty">Chưa có khách hàng phù hợp.</div>}</div>
    </article>
  </div>;
}
