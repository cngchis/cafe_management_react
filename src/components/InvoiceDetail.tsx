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
};

const formatAmount = (amount: number) => amount.toLocaleString("en-US");

export function InvoiceDetail({ invoice, onBack }: InvoiceDetailProps) {
  const itemCount = invoice.items.reduce((sum, item) => sum + item.quantity, 0);
  const paid = invoice.paidAmount ?? (invoice.status === "Hoàn thành" ? invoice.total : 0);

  return <div className="invoice-detail-page page-enter">
    <nav className="invoice-detail-nav" aria-label="Điều hướng chi tiết hóa đơn">
      <button className="invoice-back" aria-label="Quay lại hóa đơn" onClick={onBack}><Icon name="chevron" size={28} /></button>
      <button className="invoice-more" aria-label="Tùy chọn hóa đơn"><Icon name="menu" size={22} /></button>
    </nav>
    <section className="invoice-detail-card invoice-detail-header">
      <div className="invoice-detail-heading"><div><h2>{invoice.id}</h2><time>{invoice.date} {invoice.time}</time></div><span className="invoice-paid">{invoice.status}</span></div>
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
  </div>;
}
