import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { formatMoney, type Product } from "../data/products";
import type { CustomerTarget } from "../api/moreOperations";
import { createCustomer } from "../api/customers";
import type { BankAccount } from "../api/cashbook";

type CartItem = Product & { quantity: number };

type CartPanelProps = {
  items: CartItem[];
  customers: CustomerTarget[];
  customerId: string;
  bankAccount: BankAccount | null;
  onCustomerChange: (customerId: string) => void;
  onCustomerCreated: (customer: CustomerTarget) => void;
  onUpdateCart: (id: string, delta: number) => void;
  onClearCart: () => void;
  onClose: () => void;
  onComplete: (orderType: "dine_in" | "takeaway" | "delivery", note: string, idempotencyKey: string, payment: { amountReceivedVnd: number; paymentMethod: "cash" | "bank_transfer"; customerName: string; customerId?: string; discountVnd: number; transferReference?: string; bankAccountId?: string }) => Promise<string>;
};

export function CartPanel({ items, customers, customerId, bankAccount, onCustomerChange, onCustomerCreated, onUpdateCart, onClearCart, onClose, onComplete }: CartPanelProps) {
  const [orderType, setOrderType] = useState("Mang về");
  const [orderNote, setOrderNote] = useState("");
  const [paid, setPaid] = useState(false);
  const [paidOrderNumber, setPaidOrderNumber] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [tenderEdited, setTenderEdited] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer">("cash");
  const [activeSheet, setActiveSheet] = useState<"customer" | "createCustomer" | "orderType" | "note" | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountMode, setDiscountMode] = useState<"vnd" | "percent">("vnd");
  const [discountInput, setDiscountInput] = useState("");
  const [discountVnd, setDiscountVnd] = useState(0);
  const [showTransferQr, setShowTransferQr] = useState(false);
  const [transferReference, setTransferReference] = useState("");
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const appliedDiscountVnd = Math.min(discountVnd, subtotal);
  const total = subtotal - appliedDiscountVnd;
  useEffect(() => {
    if (discountMode !== "percent" || discountInput === "") return;
    const percent = Number(discountInput);
    if (Number.isFinite(percent) && percent >= 0) setDiscountVnd(Math.round(subtotal * Math.min(percent, 100) / 100));
  }, [discountInput, discountMode, subtotal]);
  useEffect(() => {
    if (paymentMethod === "bank_transfer") {
      setAmountReceived(String(total));
      setTenderEdited(false);
    } else if (!tenderEdited) setAmountReceived(String(total));
  }, [paymentMethod, total, tenderEdited]);
  const receivedVnd = Number(amountReceived) || 0;
  const creditVnd = Math.max(0, total - receivedVnd);
  const changeVnd = Math.max(0, receivedVnd - total);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const effectiveCustomerName = selectedCustomer?.name ?? "";
  const completePayment = async (reference?: string) => {
    if (!items.length || isPaying) return;
    const fingerprint = JSON.stringify({ orderType, orderNote, paymentMethod, amountReceived, customerId, appliedDiscountVnd, transferReference: reference, bankAccountId: reference ? bankAccount?.id : undefined, items: items.map(({ id, quantity }) => [id, quantity]) });
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    setIsPaying(true);
    setPaymentError("");
    try {
      const orderNumber = await onComplete(orderType === "Tại bàn" ? "dine_in" : orderType === "Giao đi" ? "delivery" : "takeaway", orderNote, attempt.current.key, { amountReceivedVnd: receivedVnd, paymentMethod, customerName: effectiveCustomerName, customerId: customerId || undefined, discountVnd: appliedDiscountVnd, transferReference: reference, bankAccountId: reference ? bankAccount?.id : undefined });
      attempt.current = null;
      setOrderNote("");
      setTenderEdited(false);
      setPaymentMethod("cash");
      setShowTransferQr(false);
      setTransferReference("");
      setDiscountVnd(0); setDiscountInput("");
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

  const startPayment = () => {
    if (paymentMethod === "cash") { void completePayment(); return; }
    if (total <= 0) {
      setPaymentError("Đơn hàng không có số tiền cần thanh toán bằng chuyển khoản.");
      return;
    }
    if (!bankAccount) {
      setPaymentError("Chưa có tài khoản nhận tiền. Hãy thêm tài khoản tại Sổ quỹ > Ngân hàng.");
      return;
    }
    setPaymentError("");
    setTransferReference(`CF${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`);
    setShowTransferQr(true);
  };

  useEffect(() => {
    if (!showTransferQr) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !isPaying) setShowTransferQr(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showTransferQr, isPaying]);

  const qrParams = new URLSearchParams({ amount: String(total), addInfo: transferReference, accountName: bankAccount?.accountHolder ?? "" });
  const qrUrl = bankAccount ? `https://img.vietqr.io/image/${encodeURIComponent(bankAccount.bankCode)}-${encodeURIComponent(bankAccount.accountNumber)}-compact2.svg?${qrParams}` : "";

  const addCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreatingCustomer(true);
    setPaymentError("");
    try {
      const result = await createCustomer({ name: newCustomerName.trim(), phone: newCustomerPhone.trim() || undefined });
      const customer = { id: result.customer.id, name: result.customer.name, phone: result.customer.phone };
      onCustomerCreated(customer);
      onCustomerChange(customer.id);
      setNewCustomerName(""); setNewCustomerPhone(""); setActiveSheet("customer");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Không thể tạo khách hàng.");
    } finally { setIsCreatingCustomer(false); }
  };

  const applyDiscount = () => {
    const value = Number(discountInput);
    if (!Number.isFinite(value) || value < 0) return;
    const requested = discountMode === "percent" ? Math.round(subtotal * Math.min(value, 100) / 100) : Math.round(value);
    const applied = Math.min(subtotal, Math.max(0, requested));
    setDiscountVnd(applied);
    setDiscountInput(discountMode === "percent" ? String(Math.min(value, 100)) : String(applied));
    setShowDiscountModal(false);
  };

  return <aside id="cart-panel" className="cart-panel" role="dialog" aria-modal="true" aria-label="Giỏ hàng">
    <div className="cart-head"><div><h2>ĐƠN HIỆN TẠI</h2></div><div className="cart-head-actions"><button className="icon-button" disabled={isPaying} onClick={onClearCart} aria-label="Xóa đơn"><Icon name="trash" size={18} /></button><button className="icon-button" onClick={onClose} aria-label="Đóng giỏ hàng"><Icon name="close" size={18} /></button></div></div>
    <div className="cart-quick-actions">
      <button type="button" disabled={isPaying} onClick={() => setActiveSheet("customer")}><Icon name="users" size={17} /><span>{selectedCustomer?.name ?? "Khách lẻ"}</span></button>
      <button type="button" disabled={isPaying} onClick={() => setActiveSheet("orderType")}><Icon name="store" size={17} /><span>{orderType}</span></button>
      <button type="button" disabled={isPaying} onClick={() => setActiveSheet("note")}><Icon name="receipt" size={17} /><span>{orderNote ? "Có ghi chú" : "Ghi chú"}</span></button>
    </div>
    {activeSheet && <div className="cart-sheet-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveSheet(null); }}><section className="cart-bottom-sheet" role="dialog" aria-modal="true" aria-label={activeSheet === "customer" ? "Chọn khách hàng" : activeSheet === "createCustomer" ? "Tạo khách hàng" : activeSheet === "orderType" ? "Chọn loại đơn" : "Ghi chú đơn hàng"}>
      <div className="cart-sheet-heading"><h3>{activeSheet === "customer" ? "Khách hàng" : activeSheet === "createCustomer" ? "Tạo khách hàng" : activeSheet === "orderType" ? "Loại đơn hàng" : "Ghi chú"}</h3><button type="button" className="icon-button" onClick={() => setActiveSheet(null)} aria-label="Đóng"><Icon name="close" size={18} /></button></div>
      {activeSheet === "customer" && <div className="cart-sheet-options"><button type="button" className={!customerId ? "selected" : ""} onClick={() => { onCustomerChange(""); setActiveSheet(null); }}>Khách lẻ · Giá chung</button>{customers.map((customer) => <button type="button" className={customer.id === customerId ? "selected" : ""} key={customer.id} onClick={() => { onCustomerChange(customer.id); setActiveSheet(null); }}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</button>)}<button type="button" className="cart-sheet-create" onClick={() => setActiveSheet("createCustomer")}>+ Tạo khách hàng mới</button></div>}
      {activeSheet === "createCustomer" && <form className="pos-create-customer" onSubmit={(event) => void addCustomer(event)}><label className="setting-field"><span>Tên khách hàng</span><input required autoFocus maxLength={200} value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} /></label><label className="setting-field"><span>Số điện thoại (không bắt buộc)</span><input maxLength={32} value={newCustomerPhone} onChange={(event) => setNewCustomerPhone(event.target.value)} /></label><button className="primary-button" type="submit" disabled={isCreatingCustomer}>{isCreatingCustomer ? "Đang lưu..." : "Lưu khách hàng"}</button></form>}
      {activeSheet === "orderType" && <div className="cart-sheet-options">{["Tại bàn", "Mang về", "Giao đi"].map((type) => <button type="button" key={type} className={orderType === type ? "selected" : ""} onClick={() => { setOrderType(type); setActiveSheet(null); }}>{type}</button>)}</div>}
      {activeSheet === "note" && <div className="cart-sheet-note"><textarea autoFocus disabled={isPaying} maxLength={2000} value={orderNote} onChange={(event) => setOrderNote(event.target.value)} placeholder="Nhập ghi chú cho đơn hàng..." /><button className="primary-button" type="button" onClick={() => setActiveSheet(null)}>Lưu ghi chú</button></div>}
    </section></div>}
    <div className="cart-items">
      {items.length ? items.map((item) => <div className="cart-item" key={item.id}><img src={item.image} alt="" /><div className="cart-item-main"><div><strong>{item.name}</strong><span>Size M · Ít đá</span></div><div className="cart-item-bottom"><b>{formatMoney(item.price * item.quantity)}</b><div className="stepper"><button disabled={isPaying} onClick={() => onUpdateCart(item.id, -1)}><Icon name="minus" size={14} /></button><span>{item.quantity}</span><button disabled={isPaying} onClick={() => onUpdateCart(item.id, 1)}><Icon name="plus" size={14} /></button></div></div></div></div>) : <div className="cart-empty"><div><Icon name="coffee" /></div><strong>Đơn hàng trống</strong><span>Chọn món từ thực đơn để bắt đầu</span></div>}
    </div>
    <div className="bill">
      <div><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></div>
      <div className="discount"><span>Giảm giá</span><button type="button" disabled={isPaying} onClick={() => { setDiscountInput(discountMode === "percent" ? discountInput : String(appliedDiscountVnd || "")); setShowDiscountModal(true); }}>{appliedDiscountVnd ? `− ${formatMoney(appliedDiscountVnd)}` : "+ Nhập giảm giá"}</button></div>
      <div className="bill-total"><span>Tổng cộng</span><strong>{formatMoney(total)}</strong></div>
    </div>
    {showDiscountModal && <div className="discount-modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDiscountModal(false); }}><section className="discount-modal" role="dialog" aria-modal="true" aria-labelledby="discount-title"><div className="cart-sheet-heading"><h3 id="discount-title">Giảm giá đơn hàng</h3><button type="button" className="icon-button" onClick={() => setShowDiscountModal(false)} aria-label="Đóng"><Icon name="close" size={18} /></button></div><div className="discount-input-row"><input autoFocus type="number" min="0" max={discountMode === "percent" ? 100 : subtotal} step={discountMode === "percent" ? "0.01" : "1"} value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} placeholder="Nhập số tiền giảm" /><button type="button" className={discountMode === "vnd" ? "active" : ""} onClick={() => { setDiscountMode("vnd"); setDiscountInput(String(appliedDiscountVnd || "")); }}>VND</button><button type="button" className={discountMode === "percent" ? "active" : ""} onClick={() => { setDiscountMode("percent"); setDiscountInput(appliedDiscountVnd && subtotal ? String(Number((appliedDiscountVnd / subtotal * 100).toFixed(2))) : ""); }}>%</button></div><p>Giảm: {formatMoney(discountMode === "percent" ? Math.round(subtotal * Math.min(Number(discountInput) || 0, 100) / 100) : Math.min(subtotal, Number(discountInput) || 0))}</p><div className="discount-modal-actions"><button type="button" className="text-button" onClick={() => { setDiscountVnd(0); setDiscountInput(""); setShowDiscountModal(false); }}>Xóa giảm giá</button><button type="button" className="primary-button" onClick={applyDiscount}>Áp dụng</button></div></section></div>}
    <div className="payment-tender">
      <label className="setting-field"><span>Hình thức khách trả</span><select disabled={isPaying} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cash" | "bank_transfer")}><option value="cash">Tiền mặt</option><option value="bank_transfer">Chuyển khoản</option></select></label>
      <label className="setting-field"><span>Số tiền khách trả (VND)</span><input type="number" min="0" step="1" max={Number.MAX_SAFE_INTEGER} disabled={isPaying || paymentMethod === "bank_transfer"} value={amountReceived} onChange={(event) => { setTenderEdited(true); setAmountReceived(event.target.value); }} /></label>
      {changeVnd > 0 && <p className="payment-tender-note">Tiền trả dư: <strong>{formatMoney(changeVnd)}</strong></p>}
      {creditVnd > 0 && <>
        <p className="payment-credit-note">Công nợ ghi nhận: <strong>{formatMoney(creditVnd)}</strong></p>
      </>}
    </div>
    {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
    <button className="pay-button" disabled={!items.length || isPaying || !Number.isSafeInteger(receivedVnd) || receivedVnd < 0} onClick={startPayment}><span><Icon name="wallet" /> {isPaying ? "Đang thanh toán..." : "Thanh toán"}</span><strong>{formatMoney(total)}</strong></button>
    {showTransferQr && bankAccount && <div className="transfer-qr-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPaying) setShowTransferQr(false); }}><section className="transfer-qr-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-qr-title">
      <div className="cart-sheet-heading"><h3 id="transfer-qr-title">Quét mã để chuyển khoản</h3><button type="button" className="icon-button" disabled={isPaying} onClick={() => setShowTransferQr(false)} aria-label="Đóng mã QR"><Icon name="close" size={18} /></button></div>
      <p className="transfer-qr-hint">Mã đã điền sẵn số tiền. Xác nhận sau khi kiểm tra đã nhận tiền.</p>
      <img className="transfer-qr-image" src={qrUrl} alt={`Mã QR thanh toán ${formatMoney(total)} đến ${bankAccount.bankName}`} />
      <dl className="transfer-qr-details"><div><dt>Ngân hàng</dt><dd>{bankAccount.bankName}</dd></div><div><dt>Số tài khoản</dt><dd>{bankAccount.accountNumber}</dd></div><div><dt>Chủ tài khoản</dt><dd>{bankAccount.accountHolder}</dd></div><div><dt>Số tiền</dt><dd>{formatMoney(total)} ₫</dd></div><div><dt>Nội dung chuyển khoản</dt><dd>{transferReference}</dd></div></dl>
      {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
      <button type="button" className="primary-button transfer-qr-confirm" disabled={isPaying} onClick={() => void completePayment(transferReference)}>{isPaying ? "Đang lưu đơn..." : "Đã nhận được chuyển khoản"}</button>
    </section></div>}
    {paid && <div className="success-toast"><div><Icon name="check" /></div><span><strong>Thanh toán thành công</strong>Đơn {paidOrderNumber} đã được lưu</span></div>}
  </aside>;
}
