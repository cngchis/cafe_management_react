import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { downloadPayroll, getPayroll, type PayrollRow } from "../api/workforce";

const monthValue = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const formatMoney = (amount: number) => `${Math.round(amount).toLocaleString("vi-VN")} ₫`;

export function PayrollPage() {
  const [month, setMonth] = useState(monthValue());
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPayroll(month).then((result) => { if (active) { setRows(result); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải bảng lương."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month]);

  const totalHours = rows.reduce((sum, row) => sum + row.hoursWorked, 0);
  const totalPay = rows.reduce((sum, row) => sum + row.amountVnd, 0);

  const exportFile = async () => {
    setDownloading(true); setError("");
    try { await downloadPayroll(month); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải file Excel."); }
    finally { setDownloading(false); }
  };

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome"><div><span className="eyebrow">NHÂN SỰ</span><h2>Bảng tính lương</h2><p>Lương tính theo đơn giá giờ và thời lượng ca đã xếp, sau khi trừ giờ nghỉ.</p></div></section>
    {error && <p className="menu-help" role="alert">{error}</p>}
    <div className="payroll-controls"><label className="setting-field"><span>Tháng lương</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><button className="primary-button" type="button" disabled={downloading || loading} onClick={() => void exportFile()}><Icon name="receipt" size={16} />{downloading ? "Đang xuất..." : "Tải Excel"}</button></div>
    <section className="payroll-summary" aria-label="Tổng hợp lương tháng">
      <article><span>Tổng nhân viên</span><strong>{rows.length}</strong></article>
      <article><span>Tổng giờ theo lịch</span><strong>{totalHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} giờ</strong></article>
      <article><span>Tổng lương dự kiến</span><strong>{formatMoney(totalPay)}</strong></article>
    </section>
    <section className="panel payroll-panel">
      <div className="panel-heading"><div><h3>Lương theo nhân viên</h3><p>Không bao gồm thưởng, khấu trừ hoặc điều chỉnh công.</p></div></div>
      <div className="payroll-table-wrap"><table className="payroll-table"><thead><tr><th>Nhân viên</th><th>Số ca</th><th>Giờ tính lương</th><th>Đơn giá bình quân/giờ</th><th>Thành tiền</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.id}><td><strong>{row.displayName}</strong><small>@{row.username}</small></td><td>{row.shiftCount}</td><td>{row.hoursWorked.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}</td><td>{formatMoney(row.hourlyRateVnd)}</td><td><strong>{formatMoney(row.amountVnd)}</strong></td></tr>)}
        {!loading && !rows.length && <tr><td colSpan={5} className="payroll-empty">Tháng này chưa có ca được xếp.</td></tr>}
        {loading && <tr><td colSpan={5} className="payroll-empty">Đang tải bảng lương...</td></tr>}
      </tbody></table></div>
    </section>
    <p className="payroll-notice"><Icon name="clock" size={15} /> Số giờ được tính từ ca đã xếp; nếu ca có giờ nghỉ, thời gian nghỉ đã được trừ.</p>
  </div>;
}
