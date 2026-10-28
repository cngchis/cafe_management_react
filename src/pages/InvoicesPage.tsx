import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Account } from "../api/auth";
import { Icon } from "../components/Icon";
import { InvoiceDetail, type Invoice } from "../components/InvoiceDetail";
import { cancelOrder, getOrder, getOrders, type OrderDetailRecord, type OrderRecord } from "../api/orders";

const periods = ["Hôm nay", "Hôm qua", "Tuần này", "Tháng này"];
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
    paymentMethod: order.status === "cancelled" ? "Đã hoàn tiền" : displayPaymentMethod(order.paymentMethod),
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

function matchesPeriod(orderedAt: string, period: string) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "Hôm qua") start.setDate(start.getDate() - 1);
  else if (period === "Tuần này") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else if (period === "Tháng này") start.setDate(1);
  const date = new Date(orderedAt);
  if (date < start) return false;
  if (period === "Hôm qua") {
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return date < end;
  }
  return true;
}

export function InvoicesPage({ role }: { role: Account["role"] }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("Hôm nay");
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
      ? { ...invoice, status: "Đã hủy", paidAmount: 0, paymentMethod: "Đã hoàn tiền" }
      : invoice));
    setSelectedInvoice((current) => current?.recordId === id
      ? { ...current, status: "Đã hủy", paidAmount: 0, paymentMethod: "Đã hoàn tiền" }
      : current);
  };

  const visibleInvoices = invoices
    .filter((invoice) => matchesPeriod(invoice.orderedAt, period))
    .filter((invoice) => {
      const hour = new Date(invoice.orderedAt).getHours();
      return startHour <= endHour
        ? hour >= startHour && hour <= endHour
        : hour >= startHour || hour <= endHour;
    })
    .filter((invoice) => invoice.id.toLowerCase().includes(query.toLowerCase()) || invoice.customer.toLowerCase().includes(query.toLowerCase()))
    .slice()
    .sort((first, second) => (sortDescending ? -1 : 1) * first.orderedAt.localeCompare(second.orderedAt));
  const invoiceTotal = visibleInvoices.reduce((sum, invoice) => sum + (invoice.status === "Hoàn thành" ? invoice.total : 0), 0);

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
      <label className="cashbook-select"><Icon name="filter" size={17} /><select value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map((item) => <option key={item}>{item}</option>)}</select><Icon name="chevron" size={15} /></label>
      <div className="invoice-hour-filter">
        <button type="button" className="cashbook-select invoice-hour-trigger" aria-expanded={isHourPickerOpen} onClick={() => setIsHourPickerOpen((open) => !open)}>
          <span>{startHour === 0 && endHour === 23 ? "Tất cả khung giờ" : `${startHour}h–${endHour}h`}</span><Icon name="chevron" size={15} />
        </button>
        {isHourPickerOpen && <div className="invoice-hour-popover" role="group" aria-label="Chọn khung giờ">
          <label><span>Từ</span><select aria-label="Giờ bắt đầu" value={startHour} onChange={(event) => setStartHour(Number(event.target.value))}>{hours.map((item, index) => <option key={index} value={index}>{item}</option>)}</select></label>
          <label><span>Đến</span><select aria-label="Giờ kết thúc" value={endHour} onChange={(event) => setEndHour(Number(event.target.value))}>{hours.map((item, index) => <option key={index} value={index}>{item}</option>)}</select></label>
          <button type="button" className="primary-button" onClick={() => setIsHourPickerOpen(false)}>Áp dụng</button>
        </div>}
      </div>
    </div>
    <section className="invoice-summary">
      <div><button className="invoice-summary-label">Tổng thanh toán <Icon name="chevron" size={15} /></button><span>{visibleInvoices.length} hóa đơn</span></div>
      <strong>{formatAmount(invoiceTotal)}</strong>
    </section>
    <section className="invoice-ledger" aria-live="polite">
      <div className="invoice-date">GIAO DỊCH GẦN ĐÂY · {period.toUpperCase()}</div>
      {isLoading && <div className="management-empty" role="status">Đang tải hóa đơn...</div>}
      {!isLoading && loadError && <div className="management-empty" role="alert"><p>{loadError}</p><button type="button" onClick={() => void loadInvoices()}>Thử lại</button></div>}
      {!isLoading && !loadError && visibleInvoices.map((invoice) => <button className="invoice-row" key={invoice.recordId} type="button" onClick={() => void openInvoice(invoice.recordId)}>
        <span className="invoice-row-copy"><strong>{invoice.id}</strong><small>{invoice.time} · {invoice.customer}</small><small>{invoice.orderType}</small></span>
        <span className="invoice-row-values"><strong>{formatAmount(invoice.total)}</strong><small>{invoice.status === "Đã hủy" ? "Đã hủy" : invoice.paymentMethod}</small></span>
      </button>)}
      {!isLoading && !loadError && !visibleInvoices.length && <div className="management-empty">Chưa có hóa đơn trong khoảng thời gian này.</div>}
    </section>
  </div>;
}
