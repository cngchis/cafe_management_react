import { useEffect, useState, type FormEvent } from "react";
import { createEmployee, getEmployees, updateEmployee, type EmployeeRecord } from "../api/employees";

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")} ₫`;

export function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ username: "", password: "", displayName: "", role: "cashier" as EmployeeRecord["role"], hourlyRateVnd: "" });

  const refresh = async () => {
    try { setEmployees(await getEmployees()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải danh sách nhân viên."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await createEmployee({ ...draft, username: draft.username.trim(), displayName: draft.displayName.trim(), hourlyRateVnd: Number(draft.hourlyRateVnd) || 0 });
      setDraft({ username: "", password: "", displayName: "", role: "cashier", hourlyRateVnd: "" });
      setNotice("Đã tạo tài khoản nhân viên."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo nhân viên."); }
    finally { setSaving(false); }
  };

  const save = async (employee: EmployeeRecord) => {
    setSavingId(employee.id); setError(""); setNotice("");
    try {
      const updated = await updateEmployee(employee.id, { displayName: employee.displayName, role: employee.role, hourlyRateVnd: employee.hourlyRateVnd });
      setEmployees((current) => current.map((item) => item.id === updated.id ? updated : item)); setNotice(`Đã lưu ${updated.displayName}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu nhân viên."); }
    finally { setSavingId(null); }
  };

  const toggleActive = async (employee: EmployeeRecord) => {
    setSavingId(employee.id); setError("");
    try {
      const updated = await updateEmployee(employee.id, { isActive: !employee.isActive });
      setEmployees((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái nhân viên."); }
    finally { setSavingId(null); }
  };

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome"><div><span className="eyebrow">NHÂN SỰ</span><h2>Nhân viên</h2><p>Tạo tài khoản đăng nhập, phân quyền và đặt đơn giá theo giờ.</p></div></section>
    {error && <p className="menu-help" role="alert">{error}</p>}{notice && <p className="menu-help" role="status">{notice}</p>}
    <form className="panel employee-create-panel" onSubmit={create}>
      <div className="panel-heading"><div><h3>Thêm nhân viên</h3><p>Mật khẩu tối thiểu 8 ký tự; hệ thống lưu dưới dạng băm.</p></div></div>
      <div className="employee-create-grid">
        <label className="setting-field"><span>Tên nhân viên</span><input required maxLength={200} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
        <label className="setting-field"><span>Tên đăng nhập</span><input required maxLength={100} autoComplete="username" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} /></label>
        <label className="setting-field"><span>Mật khẩu ban đầu</span><input required minLength={8} type="password" autoComplete="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></label>
        <label className="setting-field"><span>Vai trò</span><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as EmployeeRecord["role"] })}><option value="cashier">Thu ngân</option><option value="manager">Quản lý</option></select></label>
        <label className="setting-field"><span>Lương theo giờ (₫)</span><input required min="0" step="1" type="number" value={draft.hourlyRateVnd} onChange={(event) => setDraft({ ...draft, hourlyRateVnd: event.target.value })} /></label>
      </div>
      <div className="employee-create-footer"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Đang tạo..." : "Tạo tài khoản"}</button></div>
    </form>
    <section className="panel employee-list-panel">
      <div className="panel-heading"><div><h3>Danh sách nhân viên</h3><p>{employees.filter((item) => item.isActive).length} đang hoạt động · {employees.length} tài khoản</p></div></div>
      {loading && <div className="management-empty">Đang tải nhân viên...</div>}
      {!loading && !employees.length && <div className="management-empty">Chưa có tài khoản nhân viên.</div>}
      {employees.map((employee) => <article className={`employee-row ${employee.isActive ? "" : "inactive"}`} key={employee.id}>
        <div className="employee-identity"><label className="setting-field"><span>Tên hiển thị</span><input maxLength={200} value={employee.displayName} onChange={(event) => setEmployees((current) => current.map((item) => item.id === employee.id ? { ...item, displayName: event.target.value } : item))} /></label><small>@{employee.username}{employee.isActive ? "" : " · Đã khóa"}</small></div>
        <label className="setting-field"><span>Vai trò</span><select value={employee.role} onChange={(event) => setEmployees((current) => current.map((item) => item.id === employee.id ? { ...item, role: event.target.value as EmployeeRecord["role"] } : item))}><option value="cashier">Thu ngân</option><option value="manager">Quản lý</option></select></label>
        <label className="setting-field"><span>Lương/giờ</span><input type="number" min="0" step="1" value={employee.hourlyRateVnd} onChange={(event) => setEmployees((current) => current.map((item) => item.id === employee.id ? { ...item, hourlyRateVnd: Number(event.target.value) } : item))} /></label>
        <div className="employee-row-actions"><small>{formatMoney(employee.hourlyRateVnd)}/giờ</small><button className="secondary-button" type="button" disabled={savingId === employee.id} onClick={() => void save(employee)}>Lưu</button><button className="text-button" type="button" disabled={savingId === employee.id} onClick={() => void toggleActive(employee)}>{employee.isActive ? "Khóa" : "Mở khóa"}</button></div>
      </article>)}
    </section>
  </div>;
}
