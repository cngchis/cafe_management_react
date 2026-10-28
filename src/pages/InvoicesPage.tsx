import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { Account } from "../api/auth";
import { Icon } from "../components/Icon";
import { InvoiceDetail, type Invoice } from "../components/InvoiceDetail";
import { cancelOrder, getOrder, getOrders, type OrderDetailRecord, type OrderRecord } from "../api/orders";

const periods = ["Toàn thời gian", "Hôm nay", "Hôm qua", "7 ngày qua", "Tháng này", "Tháng trước", "Tùy chỉnh"];
const hours = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
const formatAmount = (amount: number) => amount.toLocaleString("en-US");

function displayOrderType(order: OrderRecord) {
  if (order.orderType === "dine_in") return order.serviceLocation || "Tại bàn";
  if (order.orderType === "delivery") return "Giao hàng";
  if (order.orderType === "staff") return "Nhân viên";
  return "Mang đi";
}

function displayPaymentMethod(method: string | null) {
  if (method === "bank_transfer") return "Chuyển khoản";
  if (method === "card") return "Thẻ";
  if (method === "credit") return "Công nợ";
  if (method === "other") return "Khác";
  return method ? "Tiền mặt" : "Chưa thanh toán";
}

function toInvoice(order: OrderRecord): Invoice {
  const date = new Date(order.orderedAt);
  return {
    id: order.receiptCode,
    recordId: order.id,
    date: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date),
    customer: "Khách lẻ",
    total: order.totalVnd,
    subtotal: order.subtotalVnd,
    serviceFee: order.serviceFeeVnd,
    paidAmount: order.paidAmountVnd,
    discount: order.discountVnd,
    status: order.status === "completed" ? "Hoàn thành" : order.status === "cancelled" ? "Đã hủy" : order.status === "awaiting_payment" ? "Chờ thanh toán" : order.status,
    paymentMethod: displayPaymentMethod(order.paymentMethod),
    orderType: displayOrderType(order),
    orderNumber: order.orderNumber,
    guests: order.guestCount,
    priceList: "Bảng giá chung",
    branch: "Chi nhánh trung tâm",
    cashier: order.cashierName || "—",
    orderedAt: order.orderedAt,
    items: [],
  };
}

function toInvoiceDetail(order: OrderDetailRecord): Invoice {
  return {
    ...toInvoice(order),
    items: order.items.map((item) => ({
      name: item.name,
      portion: item.portion || "Phần",
      note: item.note || "",
      quantity: item.quantity,
      unitPrice: item.unitPriceVnd,
    })),
  };
}

function toLocalDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function matchesPeriod(orderedAt: string, period: string, dateFrom: string, dateTo: string) {
  const date = new Date(orderedAt);
  if (period === "Toàn thời gian") return true;
  if (period === "Tùy chỉnh") {
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    end.setDate(end.getDate() + 1);
    return date >= start && date < end;
  }
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "Hôm qua") start.setDate(start.getDate() - 1);
  else if (period === "7 ngày qua") start.setDate(start.getDate() - 6);
  else if (period === "Tháng này") start.setDate(1);
  else if (period === "Tháng trước") {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
  }
  if (date < start) return false;
  if (period === "Hôm qua" || period === "Tháng trước") {
    const end = new Date(start);
    if (period === "Hôm qua") end.setDate(end.getDate() + 1);
    else end.setMonth(end.getMonth() + 1);
    return date < end;
  }
  return true;
}

export function InvoicesPage({ role }: { role: Account["role"] }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("Hôm nay");
  const [dateFrom, setDateFrom] = useState(() => toLocalDateValue(new Date()));
  const [dateTo, setDateTo] = useState(() => toLocalDateValue(new Date()));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [selectedCashier, setSelectedCashier] = useState("all");
  const [startHour, setStartHour] = useState(0);
  const [endHour, setEndHour] = useState(23);
  const [isHourPickerOpen, setIsHourPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortDescending, setSortDescending] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadInvoices = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      setInvoices((await getOrders()).filter((order) => order.status !== "awaiting_payment").map(toInvoice));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không tải được hóa đơn.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadInvoices(); }, []);

  const openInvoice = async (id: string) => {
    setSelectedInvoiceId(id);
    setSelectedInvoice(null);
    setDetailError("");
    setIsDetailLoading(true);
    try {
      setSelectedInvoice(toInvoiceDetail(await getOrder(id)));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Không tải được chi tiết hóa đơn.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeInvoice = () => {
    setSelectedInvoiceId(null);
    setSelectedInvoice(null);
    setDetailError("");
  };

  const handleCancelInvoice = async (id: string) => {
    await cancelOrder(id);
    setInvoices((current) => current.map((invoice) => invoice.recordId === id
      ? { ...invoice, status: "Đã hủy", paidAmount: 0 }
      : invoice));
    setSelectedInvoice((current) => current?.recordId === id
      ? { ...current, status: "Đã hủy", paidAmount: 0 }
      : current);
  };

  const visibleInvoices = invoices
    .filter((invoice) => matchesPeriod(invoice.orderedAt, period, dateFrom, dateTo))
    .filter((invoice) => {
      const hour = new Date(invoice.orderedAt).getHours();
      return startHour <= endHour
        ? hour >= startHour && hour <= endHour
        : hour >= startHour || hour <= endHour;
    })
    .filter((invoice) => !selectedStatuses.length || selectedStatuses.includes(invoice.status))
    .filter((invoice) => !selectedMethods.length || selectedMethods.includes(invoice.paymentMethod))
    .filter((invoice) => selectedCashier === "all" || invoice.cashier === selectedCashier)
    .filter((invoice) => invoice.id.toLowerCase().includes(query.toLowerCase()) || invoice.customer.toLowerCase().includes(query.toLowerCase()))
    .slice()
    .sort((first, second) => (sortDescending ? -1 : 1) * first.orderedAt.localeCompare(second.orderedAt));
  const invoiceTotal = visibleInvoices.reduce((sum, invoice) => sum + (invoice.status === "Hoàn thành" ? invoice.total : 0), 0);
  const cashiers = [...new Set(invoices.map((invoice) => invoice.cashier).filter((cashier) => cashier && cashier !== "—"))].sort((first, second) => first.localeCompare(second, "vi"));
  const toggleFilterOption = (options: string[], setOptions: (next: string[]) => void, option: string) => {
    setOptions(options.includes(option) ? options.filter((item) => item !== option) : [...options, option]);
  };

  if (selectedInvoice) return <InvoiceDetail invoice={selectedInvoice} onBack={closeInvoice} canCancel={role !== "cashier"} onCancel={handleCancelInvoice} onResume={(id) => navigate(`/pos?estimateId=${encodeURIComponent(id)}`)} />;
  if (selectedInvoiceId) return <div className="invoice-detail-page page-enter">
    <nav className="invoice-detail-nav" aria-label="Điều hướng chi tiết hóa đơn">
      <button className="invoice-back" aria-label="Quay lại hóa đơn" onClick={closeInvoice}><Icon name="chevron" size={28} /></button>
    </nav>
    <section className="invoice-detail-card" role={detailError ? "alert" : "status"}>
      {isDetailLoading ? "Đang tải chi tiết hóa đơn..." : <><p>{detailError}</p><button onClick={() => void openInvoice(selectedInvoiceId)}>Thử lại</button></>}
    </section>
  </div>;

  return <div className="invoice-page page-enter">
    <header className="invoice-page-heading">
      <h1>Hóa đơn</h1>
      <div className="invoice-page-actions">
        <button className="menu-header-action" aria-label="Tìm hóa đơn" onClick={() => setSearchOpen((current) => !current)}><Icon name="search" size={24} /></button>
        <button className="menu-header-action" aria-label="Đổi thứ tự" onClick={() => setSortDescending((current) => !current)}><Icon name="sort" size={24} /></button>
        <button className="menu-header-action" aria-label="Trợ giúp"><Icon name="help" size={23} /></button>
      </div>
    </header>
    {searchOpen && <label className="menu-search"><Icon name="search" size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã hóa đơn..." /><button type="button" aria-label="Đóng tìm kiếm" onClick={() => { setSearchOpen(false); setQuery(""); }}><Icon name="close" size={17} /></button></label>}
    <div className="invoice-filters">
      <button type="button" className="cashbook-select invoice-filter-trigger" aria-label="Mở bộ lọc hóa đơn" aria-expanded={isFilterOpen} onClick={() => setIsFilterOpen(true)}><Icon name="filter" size={17} /></button>
      <button type="button" className="cashbook-select invoice-date-trigger" aria-expanded={isDatePickerOpen} onClick={() => setIsDatePickerOpen(true)}><Icon name="calendar" size={17} /><span>{period}</span><Icon name="chevron" size={15} /></button>
      <div className="invoice-hour-filter">
        <button type="button" className="cashbook-select invoice-hour-trigger" aria-expanded={isHourPickerOpen} onClick={() => setIsHourPickerOpen((open) => !open)}>
          <span>{startHour === 0 && endHour === 23 ? "Khung giờ" : `${startHour}h–${endHour}h`}</span><Icon name="chevron" size={15} />
        </button>
      </div>
    </div>
    {isFilterOpen && createPortal(<div className="invoice-date-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFilterOpen(false); }}>
      <section className="invoice-date-sheet invoice-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="invoice-filter-title">
        <h2 id="invoice-filter-title">Bộ lọc hóa đơn</h2>
        <fieldset className="invoice-filter-group">
          <legend>Trạng thái hóa đơn</legend>
          {["Hoàn thành", "Đã hủy"].map((status) => <label key={status}><input type="checkbox" checked={selectedStatuses.includes(status)} onChange={() => toggleFilterOption(selectedStatuses, setSelectedStatuses, status)} />{status}</label>)}
        </fieldset>
        <fieldset className="invoice-filter-group">
          <legend>Phương thức thanh toán</legend>
          {["Tiền mặt", "Chuyển khoản"].map((method) => <label key={method}><input type="checkbox" checked={selectedMethods.includes(method)} onChange={() => toggleFilterOption(selectedMethods, setSelectedMethods, method)} />{method}</label>)}
        </fieldset>
        <fieldset className="invoice-filter-group">
          <legend>Người tạo</legend>
          <select aria-label="Lọc theo người tạo hóa đơn" value={selectedCashier} onChange={(event) => setSelectedCashier(event.target.value)}>
            <option value="all">Tất cả người tạo</option>
            {cashiers.map((cashier) => <option key={cashier} value={cashier}>{cashier}</option>)}
          </select>
        </fieldset>
        <button className="invoice-date-back" type="button" onClick={() => setIsFilterOpen(false)}>Áp dụng</button>
      </section>
    </div>, document.body)}
    {isDatePickerOpen && createPortal(<div className="invoice-date-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDatePickerOpen(false); }}>
      <section className="invoice-date-sheet" role="dialog" aria-modal="true" aria-labelledby="invoice-date-title">
        <h2 id="invoice-date-title">Thời gian</h2>
        <div className="invoice-date-options">
          {periods.filter((item) => item !== "Tùy chỉnh").map((item) => <button key={item} type="button" className={period === item ? "active" : ""} onClick={() => { setPeriod(item); setIsDatePickerOpen(false); }}>{item}{period === item && <Icon name="check" size={22} />}</button>)}
          <button type="button" className={`invoice-date-custom ${period === "Tùy chỉnh" ? "active" : ""}`} onClick={() => setPeriod("Tùy chỉnh")}>Tùy chỉnh</button>
        </div>
        {period === "Tùy chỉnh" && <div className="invoice-custom-dates">
          <label>Từ ngày<input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); if (dateTo < event.target.value) setDateTo(event.target.value); }} /></label>
          <label>Đến ngày<input type="date" min={dateFrom} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        </div>}
        <button className="invoice-date-back" type="button" onClick={() => setIsDatePickerOpen(false)}>{period === "Tùy chỉnh" ? "Áp dụng" : "Quay lại"}</button>
      </section>
    </div>, document.body)}
    {isHourPickerOpen && createPortal(<div className="invoice-date-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsHourPickerOpen(false); }}>
      <section className="invoice-date-sheet invoice-hour-sheet" role="dialog" aria-modal="true" aria-labelledby="invoice-hour-title">
        <h2 id="invoice-hour-title">Khung giờ</h2>
        <div className="invoice-custom-dates">
          <label>Từ giờ<select aria-label="Giờ bắt đầu" value={startHour} onChange={(event) => setStartHour(Number(event.target.value))}>{hours.map((item, index) => <option key={index} value={index}>{item}</option>)}</select></label>
          <label>Đến giờ<select aria-label="Giờ kết thúc" value={endHour} onChange={(event) => setEndHour(Number(event.target.value))}>{hours.map((item, index) => <option key={index} value={index}>{item}</option>)}</select></label>
        </div>
        <button className="invoice-date-back" type="button" onClick={() => setIsHourPickerOpen(false)}>Áp dụng</button>
      </section>
    </div>, document.body)}
    <section className="invoice-summary">
      <div><button className="invoice-summary-label">Tổng thanh toán <Icon name="chevron" size={15} /></button><span>{visibleInvoices.length} hóa đơn</span></div>
      <strong>{formatAmount(invoiceTotal)}</strong>
    </section>
    <section className="invoice-ledger" aria-live="polite">
      <div className="invoice-date">GIAO DỊCH GẦN ĐÂY · {(period === "Tùy chỉnh" ? `${dateFrom} - ${dateTo}` : period).toUpperCase()}</div>
      {isLoading && <div className="management-empty" role="status">Đang tải hóa đơn...</div>}
      {!isLoading && loadError && <div className="management-empty" role="alert"><p>{loadError}</p><button type="button" onClick={() => void loadInvoices()}>Thử lại</button></div>}
      {!isLoading && !loadError && visibleInvoices.map((invoice) => <button className="invoice-row" key={invoice.recordId} type="button" onClick={() => void openInvoice(invoice.recordId)}>
        <span className="invoice-row-copy"><strong>{invoice.id}</strong><small>{invoice.time} | {invoice.customer} | {invoice.cashier}</small><small>{invoice.orderType}</small></span>
        <span className="invoice-row-values"><strong>{formatAmount(invoice.total)}</strong><small>{invoice.status === "Đã hủy" ? "Đã hủy" : invoice.paymentMethod}</small></span>
      </button>)}
      {!isLoading && !loadError && !visibleInvoices.length && <div className="management-empty">Chưa có hóa đơn trong khoảng thời gian này.</div>}
    </section>
  </div>;
}
