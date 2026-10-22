import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "../components/Icon";
import { CashbookEntryForm, type CashbookEntryFormData } from "../components/CashbookEntryForm";
import { createCashbookEntry, getCashbook, type CashbookData, type CashbookEntryRecord } from "../api/cashbook";

type Account = "Tiền mặt" | "Ngân hàng" | "Tổng quỹ";
const formatAmount = (amount: number) => amount.toLocaleString("en-US");
const formatDate = (value: string) => new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function CashbookPage() {
  const [account, setAccount] = useState<Account>("Tiền mặt");
  const [data, setData] = useState<CashbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CashbookEntryRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const refresh = useCallback(async () => {
    try { setData(await getCashbook(account === "Tiền mặt" ? "cash" : account === "Ngân hàng" ? "bank" : "all")); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải sổ quỹ."); }
  }, [account]);
  useEffect(() => { void refresh(); }, [refresh]);
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
      <div><span className="eyebrow">TÀI CHÍNH</span><h2>Sổ quỹ</h2></div>
      <div className="cashbook-actions"><button className="icon-button" aria-label="Tìm giao dịch"><Icon name="search" /></button><button className="icon-button" aria-label="Xem thêm"><Icon name="menu" /></button></div>
    </header>
    {error && <p role="alert" className="management-empty">{error}</p>}
    <div className="cashbook-tabs" role="tablist" aria-label="Tài khoản quỹ">
      {(["Tiền mặt", "Ngân hàng", "Tổng quỹ"] as const).map((item) => <button key={item} role="tab" aria-selected={account === item} className={account === item ? "active" : ""} onClick={() => setAccount(item)}>{item}</button>)}
    </div>
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
