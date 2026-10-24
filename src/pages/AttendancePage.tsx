import { useCallback, useEffect, useState } from "react";
import { clockIn, clockOut, getAttendance, type AttendanceRecord } from "../api/moreOperations";

const dayInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatTime = (value: string | null) => value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Đang trong ca";

export function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [current, setCurrent] = useState<{ id: string; clockInAt: string } | null>(null);
  const [from, setFrom] = useState(() => dayInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => dayInput(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAttendance(new Date(`${from}T00:00:00`).toISOString(), new Date(`${to}T23:59:59`).toISOString());
      setRecords(result.records); setCurrent(result.current); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu chấm công."); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { void refresh(); }, [refresh]);

  const punch = async (action: "in" | "out") => {
    setSaving(true); setError(""); setNotice("");
    try {
      if (action === "in") await clockIn(); else await clockOut();
      setNotice(action === "in" ? "Đã ghi nhận giờ vào ca." : "Đã ghi nhận giờ kết thúc ca.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu chấm công."); }
    finally { setSaving(false); }
  };

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome"><div><span className="eyebrow">NHÂN SỰ</span><h2>Chấm công</h2><p>Nhân viên chấm vào và kết thúc ca bằng tài khoản của mình.</p></div></section>
    <section className="panel attendance-punch">
      <div><span className="eyebrow">TRẠNG THÁI CA</span><h3>{current ? "Bạn đang trong ca làm" : "Bạn chưa chấm công vào"}</h3><p>{current ? `Vào ca lúc ${formatTime(current.clockInAt)}` : "Chấm công để lưu thời gian làm việc thực tế."}</p></div>
      <button className={current ? "danger-button" : "primary-button"} disabled={saving} onClick={() => void punch(current ? "out" : "in")}>{saving ? "Đang lưu…" : current ? "Chấm công ra" : "Chấm công vào"}</button>
    </section>
    {error && <p className="menu-help" role="alert">{error}</p>}{notice && <p className="menu-help" role="status">{notice}</p>}
    <section className="panel attendance-history">
      <div className="panel-heading"><div><h3>Lịch sử chấm công</h3><p>Chủ cửa hàng và quản lý xem được toàn bộ nhân viên; nhân viên chỉ xem lịch sử của mình.</p></div></div>
      <div className="attendance-filters"><label className="setting-field"><span>Từ ngày</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="setting-field"><span>Đến ngày</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
      {loading && <p className="management-empty">Đang tải lịch sử…</p>}
      {!loading && records.length === 0 && <p className="management-empty">Chưa có lần chấm công nào trong khoảng ngày này.</p>}
      {!loading && records.map((record) => <article className="attendance-row" key={record.id}>
        <span className="attendance-row-date">{new Date(record.clockInAt).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
        <span><strong>{record.employeeName}</strong><small>Vào: {formatTime(record.clockInAt)}</small></span>
        <span><strong>{record.clockOutAt ? "Đã kết thúc" : "Đang mở"}</strong><small>Ra: {formatTime(record.clockOutAt)}</small></span>
      </article>)}
    </section>
  </div>;
}
