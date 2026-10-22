import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { getEmployees, type EmployeeRecord } from "../api/employees";
import { createWorkShift, deleteWorkShift, getWorkShifts, type WorkShift } from "../api/workforce";

function mondayOf(date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - (day.getDay() + 6) % 7);
  return day;
}
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function localDateTime(date: string, time: string) { return new Date(`${date}T${time}:00`).toISOString(); }
function formatTime(date: string) { return new Date(date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); }
function formatDate(date: Date) { return date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }); }

export function WorkSchedulePage() {
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ employeeId: "", date: dateKey(new Date()), start: "08:00", end: "16:00", breakMinutes: "30", note: "" });

  const weekEnd = new Date(week); weekEnd.setDate(weekEnd.getDate() + 7);
  useEffect(() => {
    setLoading(true);
    const from = new Date(week); const to = new Date(weekEnd);
    Promise.all([getEmployees(), getWorkShifts(from.toISOString(), to.toISOString())])
      .then(([staff, currentShifts]) => { setEmployees(staff.filter((employee) => employee.isActive)); setShifts(currentShifts); setError(""); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể tải lịch làm việc."))
      .finally(() => setLoading(false));
  }, [week.getTime()]);

  const changeWeek = (offset: number) => {
    const next = new Date(week); next.setDate(next.getDate() + offset * 7);
    setWeek(next);
    setDraft((current) => ({ ...current, date: dateKey(next) }));
  };
  const refresh = async () => {
    const to = new Date(week); to.setDate(to.getDate() + 7);
    setShifts(await getWorkShifts(week.toISOString(), to.toISOString()));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await createWorkShift({ employeeId: draft.employeeId, startsAt: localDateTime(draft.date, draft.start), endsAt: localDateTime(draft.date, draft.end), breakMinutes: Number(draft.breakMinutes), note: draft.note.trim() || undefined });
      setNotice("Đã thêm ca làm."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xếp ca làm."); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    setError("");
    try { await deleteWorkShift(id); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xóa ca làm."); }
  };

  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(week); date.setDate(date.getDate() + index); return date; });
  const weekLabel = `${week.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} – ${new Date(weekEnd.getTime() - 86400000).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome"><div><span className="eyebrow">NHÂN SỰ</span><h2>Lịch làm việc</h2><p>Xếp ca theo tuần cho nhân viên đang hoạt động.</p></div></section>
    {error && <p className="menu-help" role="alert">{error}</p>}{notice && <p className="menu-help" role="status">{notice}</p>}
    <section className="panel schedule-panel">
      <div className="schedule-toolbar"><button className="secondary-button" type="button" onClick={() => changeWeek(-1)} aria-label="Tuần trước">‹</button><strong>{weekLabel}</strong><button className="secondary-button" type="button" onClick={() => changeWeek(1)} aria-label="Tuần sau">›</button><button className="text-button" type="button" onClick={() => { const today = new Date(); setWeek(mondayOf(today)); setDraft((current) => ({ ...current, date: dateKey(today) })); }}>Tuần này</button></div>
      <form className="schedule-create" onSubmit={submit}>
        <label className="setting-field"><span>Nhân viên</span><select required value={draft.employeeId} onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}><option value="">Chọn nhân viên</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}</select></label>
        <label className="setting-field"><span>Ngày</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
        <label className="setting-field"><span>Bắt đầu</span><input required type="time" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
        <label className="setting-field"><span>Kết thúc</span><input required type="time" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
        <label className="setting-field"><span>Nghỉ (phút)</span><input required min="0" max="240" type="number" value={draft.breakMinutes} onChange={(event) => setDraft({ ...draft, breakMinutes: event.target.value })} /></label>
        <label className="setting-field"><span>Ghi chú</span><input maxLength={500} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Tùy chọn" /></label>
        <button className="primary-button" type="submit" disabled={saving || !employees.length}><Icon name="plus" size={16} />{saving ? "Đang lưu..." : "Xếp ca"}</button>
      </form>
      {!employees.length && !loading && <div className="management-empty">Cần tạo nhân viên đang hoạt động trước khi xếp ca.</div>}
      <div className="schedule-week-grid" aria-busy={loading}>
        {days.map((day) => {
          const key = dateKey(day);
          const dayShifts = shifts.filter((shift) => dateKey(new Date(shift.startsAt)) === key);
          return <section className="schedule-day" key={key}><h3>{formatDate(day)}</h3>
            {dayShifts.length ? dayShifts.map((shift) => <article className="schedule-shift" key={shift.id}>
              <span className="schedule-shift-time"><Icon name="clock" size={15} />{formatTime(shift.startsAt)}–{formatTime(shift.endsAt)}</span>
              <strong>{shift.employeeName}</strong><small>Nghỉ {shift.breakMinutes} phút</small>
              {shift.note && <small>{shift.note}</small>}
              <button className="text-button" type="button" onClick={() => void remove(shift.id)}>Xóa ca</button>
            </article>) : <p className="schedule-empty">Chưa xếp ca</p>}
          </section>;
        })}
      </div>
    </section>
  </div>;
}
