import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export type CashbookDirection = "in" | "out";

export type CashbookEntryFormData = {
  title: string;
  amount: number;
  direction: CashbookDirection;
};

type CashbookEntryFormProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (entry: CashbookEntryFormData) => void;
};

export function CashbookEntryForm({ open, onClose, onSubmit }: CashbookEntryFormProps) {
  const [direction, setDirection] = useState<CashbookDirection>("in");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!title.trim() || numericAmount <= 0) return;
    onSubmit({ title: title.trim(), amount: numericAmount, direction });
    setTitle("");
    setAmount("");
    setDirection("in");
  };

  if (!open) return null;

  return createPortal(<div className="cashbook-modal-backdrop" onClick={onClose}>
    <form className="cashbook-form" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
      <div className="cashbook-form-heading"><h3>Tạo phiếu thu chi</h3><button className="icon-button" type="button" aria-label="Đóng" onClick={onClose}><Icon name="close" size={18} /></button></div>
      <div className="cashbook-direction"><button type="button" className={direction === "in" ? "active" : ""} onClick={() => setDirection("in")}>Phiếu thu</button><button type="button" className={direction === "out" ? "active" : ""} onClick={() => setDirection("out")}>Phiếu chi</button></div>
      <label className="setting-field"><span>Nội dung</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={direction === "in" ? "Ví dụ: Thu tiền khách" : "Ví dụ: Chi mua nguyên liệu"} /></label>
      <label className="setting-field"><span>Số tiền</span><input required min="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label>
      <button className="primary-button" type="submit">Lưu phiếu</button>
    </form>
  </div>, document.body);
}