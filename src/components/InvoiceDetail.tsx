import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export type InvoiceItem = {
  name: string;
  portion: string;
  note: string;
  quantity: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  recordId: string;
  date: string;
  time: string;
  customer: string;
  total: number;
  subtotal?: number;
  serviceFee?: number;
  paidAmount?: number;
  discount: number;
  status: string;
  paymentMethod: string;
  orderType: string;
  orderNumber: string;
  guests: number;
  priceList: string;
  branch: string;
  cashier: string;
  orderedAt: string;
  items: InvoiceItem[];
};

type InvoiceDetailProps = {
  invoice: Invoice;
  onBack: () => void;
  canCancel: boolean;
  onCancel: (id: string) => Promise<void>;
};

const formatAmount = (amount: number) => amount.toLocaleString("en-US");

export function InvoiceDetail({ invoice, onBack, canCancel, onCancel }: InvoiceDetailProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const sheetRef = useRef<HTMLElement>(null);
  const itemCount = invoice.items.reduce((sum, item) => sum + item.quantity, 0);
  const paid = invoice.status === "Đã hủy" ? 0 : invoice.paidAmount ?? (invoice.status === "Hoàn thành" ? invoice.total : 0);

  useEffect(() => {
    if (!menuOpen) return;
    const focusableElements = () => Array.from(sheetRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
    focusableElements()[0]?.focus();
    const handleMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCancelling) {
        setMenuOpen(false);
        setConfirmCancel(false);
      }
      if (event.key === "Tab") {
        const focusable = focusableElements();
        if (!focusable.length) {
          event.preventDefault();
          sheetRef.current?.focus();
        } else if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    };
    window.addEventListener("keydown", handleMenuKeyDown);
    return () => window.removeEventListener("keydown", handleMenuKeyDown);
  }, [menuOpen, confirmCancel, isCancelling]);

  const cancel = async () => {
    setIsCancelling(true);
    setCancelError("");
    try {
      await onCancel(invoice.recordId);
      setMenuOpen(false);
      setConfirmCancel(false);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "Không thể hủy phiếu. Vui lòng thử lại.");
      setIsCancelling(false);
    }
  };

  return <div className="invoice-detail-page page-enter">
    <nav className="invoice-detail-nav" aria-label="Điều hướng chi tiết hóa đơn">
      <button className="invoice-back" aria-label="Quay lại hóa đơn" onClick={onBack}><Icon name="chevron" size={28} /></button>
      {canCancel && invoice.status === "Hoàn thành" && <button className="invoice-more" aria-label="Tùy chọn hóa đơn" aria-haspopup="dialog" onClick={() => { setCancelError(""); setMenuOpen(true); }}><Icon name="menu" size={22} /></button>}
    </nav>
    <section className="invoice-detail-card invoice-detail-header">
      <div className="invoice-detail-heading"><div><h2>{invoice.id}</h2><time>{invoice.date} {invoice.time}</time></div><span className={`invoice-paid${invoice.status === "Đã hủy" ? " cancelled" : ""}`}>{invoice.status}</span></div>
    </section>
    <section className="invoice-detail-card invoice-customer">
      <span className="invoice-customer-icon"><Icon name="users" size={24} /></span><strong>{invoice.customer}</strong>
    </section>
    <section className="invoice-detail-card invoice-lines">
      {invoice.items.map((item) => <article className="invoice-line" key={`${invoice.id}-${item.name}`}>
        <strong>{item.name}</strong><span>{item.portion}</span>{item.note && <span>{item.note}</span>}
        <div><span>{formatAmount(item.unitPrice)} x {item.quantity}</span><strong>{formatAmount(item.unitPrice * item.quantity)}</strong></div>
      </article>)}
    </section>
    <section className="invoice-detail-card invoice-totals">
      <div><span>Tổng tiền hàng <i>{itemCount}</i></span><strong>{formatAmount(invoice.subtotal ?? invoice.total + invoice.discount)}</strong></div>
      {!!invoice.serviceFee && <div><span>Phí dịch vụ</span><strong>{formatAmount(invoice.serviceFee)}</strong></div>}
      <div><span>Giảm giá</span><strong>{formatAmount(invoice.discount)}</strong></div>
      <div className="invoice-due"><span>Khách cần trả</span><strong>{formatAmount(invoice.total)}</strong></div>
      <div className="invoice-paid-row"><span>Khách đã trả</span><strong>{formatAmount(paid)}<small>{invoice.paymentMethod}</small></strong></div>
    </section>
    <section className="invoice-detail-card invoice-meta">
      <div><span>Phòng/bàn</span><strong>{invoice.orderType}</strong></div>
      <div><span>Đơn hàng</span><strong className="invoice-link">{invoice.orderNumber}</strong></div>
      <div><span>Giờ đến</span><strong>{invoice.date} {invoice.time}</strong></div>
      <div><span>Số lượng khách</span><strong>{invoice.guests}</strong></div>
      <div><span>Bảng giá</span><strong>{invoice.priceList}</strong></div>
      <div><span>Chi nhánh</span><strong>{invoice.branch}</strong></div>
      <div><span>Thu ngân</span><strong>{invoice.cashier}</strong></div>
    </section>
    {menuOpen && createPortal(<div className="menu-detail-overlay invoice-cancel-overlay" onClick={() => { if (!isCancelling) { setMenuOpen(false); setConfirmCancel(false); } }}>
      <section ref={sheetRef} className="menu-detail-sheet invoice-cancel-sheet" role="dialog" aria-modal="true" aria-labelledby="invoice-cancel-sheet-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <span className="menu-detail-sheet-handle" aria-hidden="true" />
        <h2 id="invoice-cancel-sheet-title">{confirmCancel ? "Xác nhận hủy phiếu?" : "Tùy chọn hóa đơn"}</h2>
        {confirmCancel
          ? <p className="menu-detail-sheet-note">Phiếu <strong>{invoice.id}</strong> sẽ được hủy, tiền đã thu được ghi nhận hoàn lại và hàng hóa được nhập lại tồn kho.</p>
          : <p className="menu-detail-sheet-note">{invoice.id}</p>}
        {cancelError && <p className="menu-detail-sheet-error" role="alert">{cancelError}</p>}
        {confirmCancel ? <div className="menu-detail-sheet-actions">
          <button className="menu-detail-sheet-secondary" disabled={isCancelling} onClick={() => setConfirmCancel(false)}>Quay lại</button>
          <button className="menu-detail-sheet-danger" disabled={isCancelling} onClick={() => void cancel()}>{isCancelling ? "Đang hủy…" : "Xác nhận hủy"}</button>
        </div> : <>
          <button className="menu-detail-sheet-option" onClick={() => setConfirmCancel(true)}><Icon name="close" size={20} /><span>Hủy phiếu</span></button>
          <button className="menu-detail-sheet-secondary menu-detail-sheet-close" onClick={() => setMenuOpen(false)}>Đóng</button>
        </>}
      </section>
    </div>, document.body)}
  </div>;
}
