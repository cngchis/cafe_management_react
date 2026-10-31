import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "../components/Icon";
import { CashbookEntryForm, type CashbookEntryFormData } from "../components/CashbookEntryForm";
import { createCashbookEntry, deleteBankAccount, getBankAccounts, getCashbook, saveBankAccount, setDefaultBankAccount, updateBankAccount, type BankAccount, type CashbookData, type CashbookEntryRecord } from "../api/cashbook";

type Account = "Tiền mặt" | "Ngân hàng" | "Tổng quỹ";
const formatAmount = (amount: number) => amount.toLocaleString("en-US");
const formatDate = (value: string) => new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function CashbookPage() {
  const [account, setAccount] = useState<Account>("Tiền mặt");
  const [data, setData] = useState<CashbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CashbookEntryRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankSaving, setBankSaving] = useState(false);
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const [bankError, setBankError] = useState("");
  const [bankForm, setBankForm] = useState({ bankName: "", bankCode: "", accountNumber: "", accountHolder: "" });
  const refresh = useCallback(async () => {
    try { setData(await getCashbook(account === "Tiền mặt" ? "cash" : account === "Ngân hàng" ? "bank" : "all")); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải sổ quỹ."); }
  }, [account]);
  useEffect(() => { void refresh(); }, [refresh]);
  const refreshBankAccounts = useCallback(async () => {
    try { setBankAccounts(await getBankAccounts()); setBankError(""); }
    catch (cause) { setBankError(cause instanceof Error ? cause.message : "Không thể tải tài khoản ngân hàng."); }
  }, []);
  useEffect(() => { if (account === "Ngân hàng") void refreshBankAccounts(); }, [account, refreshBankAccounts]);
  const totals = data?.totals ?? { openingVnd: 0, incomeVnd: 0, expenseVnd: 0 };
  const entries = data?.entries ?? [];
  const closing = totals.openingVnd + totals.incomeVnd - totals.expenseVnd;
  const visibleEntries = entries;

  const addEntry = async ({ title, amount: amountVnd, direction }: CashbookEntryFormData) => {
    try {
      await createCashbookEntry({ title: title.trim(), amountVnd, direction });
      setFormOpen(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu phiếu.");
    }
  };

  const saveBank = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBankSaving(true);
    setBankError("");
    try {
      if (editingBankId) await updateBankAccount(editingBankId, bankForm);
      else await saveBankAccount(bankForm);
      setBankForm({ bankName: "", bankCode: "", accountNumber: "", accountHolder: "" });
      setBankFormOpen(false);
      setEditingBankId(null);
      await refreshBankAccounts();
    } catch (cause) {
      setBankError(cause instanceof Error ? cause.message : "Không thể lưu tài khoản ngân hàng.");
    } finally { setBankSaving(false); }
  };

  const chooseDefaultBank = async (bank: BankAccount) => {
    setBankError("");
    try {
      await setDefaultBankAccount(bank.id);
      await refreshBankAccounts();
    } catch (cause) {
      setBankError(cause instanceof Error ? cause.message : "Không thể đổi tài khoản mặc định.");
    }
  };

  const editBankAccount = (bank: BankAccount) => {
    setEditingBankId(bank.id);
    setBankForm({ bankName: bank.bankName, bankCode: bank.bankCode, accountNumber: bank.accountNumber, accountHolder: bank.accountHolder });
    setBankFormOpen(true);
    setBankError("");
  };

  const removeBankAccount = async (bank: BankAccount) => {
    if (!window.confirm(`Xóa tài khoản ${bank.bankName} · ${bank.accountNumber}? Lịch sử giao dịch vẫn được giữ lại.`)) return;
    setDeletingBankId(bank.id);
    setBankError("");
    try {
      await deleteBankAccount(bank.id);
      if (editingBankId === bank.id) {
        setEditingBankId(null);
        setBankFormOpen(false);
      }
      await refreshBankAccounts();
    } catch (cause) {
      setBankError(cause instanceof Error ? cause.message : "Không thể xóa tài khoản ngân hàng.");
    } finally {
      setDeletingBankId(null);
    }
  };

  const summary: { label: string; amount: number; icon: IconName; tone: string }[] = [
    { label: "Đầu kỳ", amount: totals.openingVnd, icon: "wallet", tone: "neutral" },
    { label: "Tổng thu", amount: totals.incomeVnd, icon: "trend", tone: "income" },
    { label: "Tổng chi", amount: -totals.expenseVnd, icon: "receipt", tone: "expense" },
    { label: "Cuối kỳ", amount: closing, icon: "wallet", tone: "closing" },
  ];

  if (selectedEntry) {
    const detailRows = [
      { label: selectedEntry.direction === "in" ? "Loại thu" : "Loại chi", value: selectedEntry.category },
      { label: selectedEntry.direction === "in" ? "Nhóm người nộp" : "Nhóm người nhận", value: selectedEntry.partyGroup ?? "—" },
      { label: selectedEntry.direction === "in" ? "Người nộp" : "Người nhận", value: selectedEntry.partyName ?? "—" },
    ];

    return <div className="cashbook-page cashbook-detail-page page-enter">
      <nav className="cashbook-detail-nav" aria-label="Điều hướng chi tiết phiếu">
        <button className="cashbook-back" aria-label="Quay lại sổ quỹ" onClick={() => setSelectedEntry(null)}><Icon name="chevron" size={28} /></button>
        <button className="cashbook-more" aria-label="Tùy chọn phiếu"><Icon name="menu" size={22} /></button>
      </nav>
      <section className="cashbook-detail-card">
        <div className="cashbook-detail-heading"><div><h2>{selectedEntry.reference}</h2><time>{formatDate(selectedEntry.occurredAt)}</time></div><span className="cashbook-paid">{selectedEntry.direction === "in" ? "Đã thanh toán" : "Đã chi"}</span></div>
        <p>{selectedEntry.description ?? selectedEntry.title}</p>
      </section>
      <section className="cashbook-detail-card cashbook-detail-rows">
        <div className="cashbook-detail-row"><span>Giá trị</span><strong>{formatAmount(selectedEntry.amountVnd)}</strong></div>
        {detailRows.map((row) => <div className="cashbook-detail-row" key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}
        <div className="cashbook-detail-row"><span>Phương thức</span><strong>{selectedEntry.account}</strong></div>
      </section>
      <section className="cashbook-detail-card cashbook-detail-meta">
        <div><span>Tài khoản</span><strong>{selectedEntry.account}</strong></div>
        <div><span>Người tạo</span><strong>{selectedEntry.cashier ?? "—"}</strong></div>
      </section>
    </div>;
  }

  return <>
    <div className="cashbook-page page-enter">
    <header className="cashbook-heading">
      <h2>Sổ quỹ</h2>
      <div className="cashbook-actions"><button className="icon-button" aria-label="Tìm giao dịch"><Icon name="search" /></button><button className="icon-button" aria-label="Xem thêm"><Icon name="menu" /></button></div>
    </header>
    {error && <p role="alert" className="management-empty">{error}</p>}
    <div className="cashbook-tabs" role="tablist" aria-label="Tài khoản quỹ">
      {(["Tiền mặt", "Ngân hàng", "Tổng quỹ"] as const).map((item) => <button key={item} role="tab" aria-selected={account === item} className={account === item ? "active" : ""} onClick={() => setAccount(item)}>{item}</button>)}
    </div>
    {account === "Ngân hàng" && <section className="bank-account-panel" aria-labelledby="bank-account-title">
      <div className="bank-account-heading"><div><h3 id="bank-account-title">Tài khoản nhận chuyển khoản</h3><p>POS dùng tài khoản mặc định để tạo mã QR.</p></div><button type="button" className="primary-button" onClick={() => { if (bankFormOpen) { setBankFormOpen(false); setEditingBankId(null); } else { setBankForm({ bankName: "", bankCode: "", accountNumber: "", accountHolder: "" }); setEditingBankId(null); setBankFormOpen(true); } }}>{bankFormOpen ? "Đóng" : "+ Thêm ngân hàng"}</button></div>
      {bankError && <p className="bank-account-error" role="alert">{bankError}</p>}
      {bankFormOpen && <form className="bank-account-form" onSubmit={(event) => void saveBank(event)}>
        <label><span>Tên ngân hàng</span><input required maxLength={100} value={bankForm.bankName} onChange={(event) => setBankForm({ ...bankForm, bankName: event.target.value })} placeholder="Ví dụ: Ngân hàng Á Châu" /></label>
        <label><span>Mã VietQR / BIN</span><input required maxLength={20} value={bankForm.bankCode} onChange={(event) => setBankForm({ ...bankForm, bankCode: event.target.value.toUpperCase() })} placeholder="Ví dụ: ACB" /></label>
        <label><span>Số tài khoản</span><input required maxLength={32} value={bankForm.accountNumber} onChange={(event) => setBankForm({ ...bankForm, accountNumber: event.target.value })} /></label>
        <label><span>Chủ tài khoản</span><input required maxLength={100} value={bankForm.accountHolder} onChange={(event) => setBankForm({ ...bankForm, accountHolder: event.target.value.toUpperCase() })} /></label>
        <p>Mã ngân hàng cần đúng mã VietQR để sinh QR chuyển khoản.</p>
        <button className="primary-button" type="submit" disabled={bankSaving}>{bankSaving ? "Đang lưu..." : editingBankId ? "Lưu thay đổi" : "Lưu và đặt mặc định"}</button>
        {editingBankId && <button className="text-button" type="button" disabled={bankSaving} onClick={() => { setEditingBankId(null); setBankFormOpen(false); }}>Hủy chỉnh sửa</button>}
      </form>}
      <div className="bank-account-list">
        {bankAccounts.map((bank) => <article className="bank-account-row" key={bank.id}>
          <div><strong>{bank.bankName}</strong><span>{bank.accountNumber} · {bank.accountHolder}</span><small>Mã VietQR: {bank.bankCode}</small></div>
          <div className="bank-account-row-actions"><button type="button" className="text-button" disabled={Boolean(deletingBankId)} onClick={() => editBankAccount(bank)}>Chỉnh sửa</button>{bank.isDefault ? <span className="bank-default-badge">Mặc định cho POS</span> : <button type="button" className="text-button" disabled={Boolean(deletingBankId)} onClick={() => void chooseDefaultBank(bank)}>Đặt mặc định</button>}<button type="button" className="text-button danger-text" disabled={deletingBankId === bank.id} onClick={() => void removeBankAccount(bank)}>{deletingBankId === bank.id ? "Đang xóa..." : "Xóa"}</button></div>
        </article>)}
        {!bankAccounts.length && !bankError && <p className="bank-account-empty">Chưa có tài khoản ngân hàng. Thêm tài khoản để nhận chuyển khoản bằng QR tại POS.</p>}
      </div>
    </section>}
    <section className="cashbook-summary" aria-label="Tổng kết sổ quỹ">
      {summary.map((item) => <article className={`cashbook-total ${item.tone}`} key={item.label}>
        <span className="cashbook-total-icon"><Icon name={item.icon} size={17} /></span><span className="cashbook-total-label">{item.label}</span><strong>{formatAmount(item.amount)}</strong>
      </article>)}
      <button className="cashbook-details" onClick={() => setPeriod("Tháng này")}>Xem chi tiết <Icon name="chevron" size={16} /></button>
    </section>
    <section className="cashbook-ledger">
      {visibleEntries.map((entry) => <button className="cashbook-entry" key={entry.id} type="button" aria-label={`Xem chi tiết phiếu ${entry.reference}`} onClick={() => setSelectedEntry(entry)}>
        <div className={`cashbook-entry-icon ${entry.direction}`}><Icon name={entry.direction === "in" ? "trend" : "receipt"} size={18} /></div>
        <div className="cashbook-entry-info"><strong>{entry.title}</strong><span>{formatDate(entry.occurredAt)} <i /> {entry.cashier ?? "—"}</span><small>{entry.reference}</small></div>
        <strong className={`cashbook-entry-amount ${entry.direction}`}>{entry.direction === "out" ? "-" : ""}{formatAmount(entry.amountVnd)}</strong>
      </button>)}
      {data && !visibleEntries.length && <div className="management-empty">Chưa có giao dịch trong tài khoản này.</div>}
    </section>
    </div>
    {createPortal(<button className="cashbook-add" aria-label="Tạo phiếu thu chi" onClick={() => setFormOpen(true)}><Icon name="plus" size={26} /></button>, document.body)}
    <CashbookEntryForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={addEntry} />
  </>;
}
