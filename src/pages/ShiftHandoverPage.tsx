import { useCallback, useEffect, useState, type FormEvent } from "react";
import { closeHandover, getHandovers, openHandover, type HandoverSheet } from "../api/moreOperations";
import { formatMoney } from "../data/products";

const formatDateTime = (date: string) => new Date(date).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function ShiftHandoverPage() {
  const [handovers, setHandovers] = useState<HandoverSheet[]>([]);
  const [current, setCurrent] = useState<HandoverSheet | null>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await getHandovers();
      setHandovers(result.handovers); setCurrent(result.current); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được phiếu giao ca."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (current) await closeHandover(current.id, Number(closingCash), note.trim() || undefined);
      else await openHandover(Number(openingCash), note.trim() || undefined);
      setNotice(current ? "Đã chốt phiếu giao ca." : "Đã mở phiếu giao ca.");
      setClosingCash(""); setNote(""); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu phiếu giao ca."); }
    finally { setSaving(false); }
  };

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome"><div><span className="eyebrow">NHÂN SỰ</span><h2>Phiếu giao ca</h2><p>Đối soát tiền đầu ca, doanh thu theo phương thức thanh toán và món bán trong ca.</p></div></section>
    {error && <p className="menu-help" role="alert">{error}</p>}{notice && <p className="menu-help" role="status">{notice}</p>}
    <section className="panel handover-panel">
      <div className="panel-heading"><div><h3>{current ? "Ca đang mở" : "Mở ca làm việc"}</h3><p>{current ? `Bắt đầu lúc ${formatDateTime(current.openedAt)}` : "Ghi nhận tiền mặt có sẵn trước khi bán hàng."}</p></div></div>
      {current && <div className="handover-summary">
        <article><span>Số hóa đơn</span><strong>{current.invoiceCount}</strong></article>
        <article><span>Doanh thu</span><strong>{formatMoney(current.revenueVnd)}</strong></article>
        <article><span>Tiền mặt</span><strong>{formatMoney(current.cashVnd)}</strong></article>
        <article><span>Chuyển khoản</span><strong>{formatMoney(current.bankTransferVnd)}</strong></article>
        <article><span>Công nợ</span><strong>{formatMoney(current.creditVnd)}</strong></article>
      </div>}
      {current && current.items.length > 0 && <div className="handover-sold-items"><h4>Món bán trong ca</h4>{current.items.map((item) => <div key={item.name}><span>{item.name} · {item.quantity}</span><strong>{formatMoney(item.revenueVnd)}</strong></div>)}</div>}
      <form className="handover-form" onSubmit={submit}>
        {!current && <label className="setting-field"><span>Tiền mặt đầu ca (VND)</span><input type="number" min="0" step="1" required value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} /> </label>}
        {current && <>
          <div className="handover-cash-expected"><span>Tiền mặt dự kiến cuối ca</span><strong>{formatMoney(current.openingCashVnd + current.cashVnd)}</strong></div>
          <label className="setting-field"><span>Tiền mặt đếm được cuối ca (VND)</span><input type="number" min="0" step="1" required value={closingCash} onChange={(event) => setClosingCash(event.target.value)} /></label>
        </>}
        <label className="setting-field"><span>Ghi chú</span><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Không bắt buộc" /></label>
        <button className={current ? "danger-button" : "primary-button"} disabled={saving} type="submit">{saving ? "Đang lưu…" : current ? "Chốt ca và lưu phiếu" : "Bắt đầu ca"}</button>
      </form>
    </section>
    <section className="panel handover-history"><div className="panel-heading"><div><h3>Lịch sử giao ca</h3><p>Doanh thu và số món lấy từ hóa đơn được tạo trong ca.</p></div></div>
      {loading && <p className="management-empty">Đang tải phiếu…</p>}
      {!loading && !handovers.length && <p className="management-empty">Chưa có phiếu giao ca.</p>}
      {handovers.map((sheet) => <article className="handover-history-row" key={sheet.id}>
        <div><strong>{sheet.employeeName}</strong><small>{formatDateTime(sheet.openedAt)} — {sheet.closedAt ? formatDateTime(sheet.closedAt) : "Đang mở"}</small></div>
        <span>{sheet.invoiceCount} hóa đơn<small>{formatMoney(sheet.revenueVnd)}</small></span>
        <span className={sheet.closedAt ? "status done" : "status pending"}>{sheet.closedAt ? `Cuối ca ${formatMoney(sheet.closingCashVnd ?? 0)}` : "Đang mở"}</span>
      </article>)}
    </section>
  </div>;
}
