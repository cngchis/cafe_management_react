import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { formatMoney, type Product } from "../data/products";
import type { CustomerTarget } from "../api/moreOperations";

type CartItem = Product & { quantity: number };

type CartPanelProps = {
  items: CartItem[];
  customers: CustomerTarget[];
  customerId: string;
  onCustomerChange: (customerId: string) => void;
  onUpdateCart: (id: string, delta: number) => void;
  onClearCart: () => void;
  onClose: () => void;
  onComplete: (orderType: "dine_in" | "takeaway" | "delivery", note: string, idempotencyKey: string, payment: { amountReceivedVnd: number; paymentMethod: "cash" | "bank_transfer"; customerName: string; customerId?: string }) => Promise<string>;
};

export function CartPanel({ items, customers, customerId, onCustomerChange, onUpdateCart, onClearCart, onClose, onComplete }: CartPanelProps) {
  const [orderType, setOrderType] = useState("Tại bàn");
  const [orderNote, setOrderNote] = useState("");
  const [paid, setPaid] = useState(false);
  const [paidOrderNumber, setPaidOrderNumber] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [tenderEdited, setTenderEdited] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer">("cash");
  const [customerName, setCustomerName] = useState("");
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const service = Math.round(subtotal * 0.05);
  const total = subtotal + service;
  useEffect(() => { if (!tenderEdited) setAmountReceived(String(total)); }, [total, tenderEdited]);
  const receivedVnd = Number(amountReceived) || 0;
  const creditVnd = Math.max(0, total - receivedVnd);
  const changeVnd = Math.max(0, receivedVnd - total);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const effectiveCustomerName = customerName.trim() || selectedCustomer?.name || "";
  const completePayment = async () => {
    if (!items.length || isPaying) return;
    if (creditVnd > 0 && !effectiveCustomerName) {
      setPaymentError("Nhập tên khách hàng khi đơn còn công nợ.");
      return;
    }
    const fingerprint = JSON.stringify({ orderType, orderNote, paymentMethod, amountReceived, customerId, effectiveCustomerName, items: items.map(({ id, quantity }) => [id, quantity]) });
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    setIsPaying(true);
    setPaymentError("");
    try {
      const orderNumber = await onComplete(orderType === "Tại bàn" ? "dine_in" : orderType === "Giao hàng" ? "delivery" : "takeaway", orderNote, attempt.current.key, { amountReceivedVnd: receivedVnd, paymentMethod, customerName: effectiveCustomerName, customerId: customerId || undefined });
      attempt.current = null;
      setOrderNote("");
      setCustomerName("");
      setTenderEdited(false);
      setPaymentMethod("cash");
      onCustomerChange("");
      setPaidOrderNumber(orderNumber);
      setPaid(true);
      setTimeout(() => setPaid(false), 3000);
      return orderNumber;
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Không thể hoàn tất thanh toán.");
    } finally {
      setIsPaying(false);
    }
  };

  return <aside id="cart-panel" className="cart-panel" role="dialog" aria-modal="true" aria-label="Giỏ hàng">
    <div className="cart-head"><div><span>ĐƠN HIỆN TẠI</span><h2>POS</h2></div><div className="cart-head-actions"><button className="icon-button" disabled={isPaying} onClick={onClearCart} aria-label="Xóa đơn"><Icon name="trash" size={18} /></button><button className="icon-button" onClick={onClose} aria-label="Đóng giỏ hàng"><Icon name="close" size={18} /></button></div></div>
    <div className="order-type">{["Tại bàn", "Mang đi", "Giao hàng"].map((type) => <button key={type} disabled={isPaying} className={orderType === type ? "active" : ""} onClick={() => setOrderType(type)}>{type}</button>)}</div>
    <button className="table-selector"><div className="table-icon"><Icon name="store" /></div><div><span>Vị trí phục vụ</span><strong>{orderType === "Tại bàn" ? "Bàn 06" : orderType}</strong></div><Icon name="chevron" size={17} /></button>
    <label className="pos-customer-selector"><span>Khách hàng để áp dụng bảng giá</span><select disabled={isPaying} value={customerId} onChange={(event) => onCustomerChange(event.target.value)}><option value="">Khách lẻ · giá chung</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
    <div className="cart-items">
      {items.length ? items.map((item) => <div className="cart-item" key={item.id}><img src={item.image} alt="" /><div className="cart-item-main"><div><strong>{item.name}</strong><span>Size M · Ít đá</span></div><div className="cart-item-bottom"><b>{formatMoney(item.price * item.quantity)}</b><div className="stepper"><button disabled={isPaying} onClick={() => onUpdateCart(item.id, -1)}><Icon name="minus" size={14} /></button><span>{item.quantity}</span><button disabled={isPaying} onClick={() => onUpdateCart(item.id, 1)}><Icon name="plus" size={14} /></button></div></div></div></div>) : <div className="cart-empty"><div><Icon name="coffee" /></div><strong>Đơn hàng trống</strong><span>Chọn món từ thực đơn để bắt đầu</span></div>}
    </div>
    <div className="note-row"><Icon name="receipt" size={17} /><input disabled={isPaying} value={orderNote} maxLength={2000} onChange={(event) => setOrderNote(event.target.value)} placeholder="Thêm ghi chú cho đơn hàng..." /></div>
    <div className="bill">
      <div><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></div>
      <div><span>Phí dịch vụ (5%)</span><strong>{formatMoney(service)}</strong></div>
      <div className="discount"><span>Giảm giá</span><button>+ Thêm ưu đãi</button></div>
      <div className="bill-total"><span>Tổng cộng</span><strong>{formatMoney(total)}</strong></div>
    </div>
    <div className="payment-tender">
      <label className="setting-field"><span>Hình thức khách trả</span><select disabled={isPaying} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cash" | "bank_transfer")}><option value="cash">Tiền mặt</option><option value="bank_transfer">Chuyển khoản</option></select></label>
      <label className="setting-field"><span>Số tiền khách trả (VND)</span><input type="number" min="0" step="1" max={Number.MAX_SAFE_INTEGER} disabled={isPaying} value={amountReceived} onChange={(event) => { setTenderEdited(true); setAmountReceived(event.target.value); }} /></label>
      {changeVnd > 0 && <p className="payment-tender-note">Tiền trả dư: <strong>{formatMoney(changeVnd)}</strong></p>}
      {creditVnd > 0 && <>
        {!selectedCustomer && <label className="setting-field"><span>Khách hàng (bắt buộc khi ghi nợ)</span><input disabled={isPaying} maxLength={200} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Tên khách hàng" /></label>}
        <p className="payment-credit-note">Công nợ ghi nhận: <strong>{formatMoney(creditVnd)}</strong></p>
      </>}
    </div>
    {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
    <button className="pay-button" disabled={!items.length || isPaying || !Number.isSafeInteger(receivedVnd) || receivedVnd < 0 || (creditVnd > 0 && !effectiveCustomerName)} onClick={() => void completePayment()}><span><Icon name="wallet" /> {isPaying ? "Đang thanh toán..." : "Thanh toán"}</span><strong>{formatMoney(total)}</strong></button>
    {paid && <div className="success-toast"><div><Icon name="check" /></div><span><strong>Thanh toán thành công</strong>Đơn {paidOrderNumber} đã được lưu</span></div>}
  </aside>;
}
