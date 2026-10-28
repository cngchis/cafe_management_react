import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { createServiceTable, deactivateServiceTable, getServiceTables, type ServiceTable } from "../api/serviceTables";

export function TablesPage() {
  const [tables, setTables] = useState<ServiceTable[]>([]);
  const [roomName, setRoomName] = useState("");
  const [tableName, setTableName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try { setTables(await getServiceTables()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được danh sách phòng bàn."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const addTable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      await createServiceTable({ roomName, tableName });
      setTableName("");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể thêm bàn."); }
    finally { setSaving(false); }
  };

  const removeTable = async (table: ServiceTable) => {
    if (!window.confirm(`Ẩn ${table.roomName} · ${table.tableName} khỏi danh sách chọn bàn?`)) return;
    try { await deactivateServiceTable(table.id); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể ẩn bàn."); }
  };

  const rooms = [...new Set(tables.map((table) => table.roomName))];
  return <div className="dashboard page-enter service-tables-page">
    <header className="service-tables-heading"><div><p className="eyebrow">THIẾT LẬP BÁN HÀNG</p><h2>Phòng bàn</h2><p>Tạo phòng và bàn để nhân viên chọn trước khi bắt đầu đơn tại bàn.</p></div></header>
    <section className="service-table-form-card"><h3>Thêm bàn</h3><form className="service-table-form" onSubmit={(event) => void addTable(event)}>
      <label className="setting-field"><span>Tên phòng</span><input required maxLength={100} value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Ví dụ: Tầng trệt" /></label>
      <label className="setting-field"><span>Tên bàn</span><input required maxLength={100} value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="Ví dụ: Bàn 1" /></label>
      <button className="primary-button" type="submit" disabled={saving}><Icon name="plus" size={17} />{saving ? "Đang lưu..." : "Thêm bàn"}</button>
    </form></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="management-empty" role="status">Đang tải phòng bàn...</p> : rooms.length === 0 ? <p className="management-empty">Chưa có bàn. Thêm phòng và bàn ở biểu mẫu phía trên.</p> : rooms.map((room) => <section className="service-room-card" key={room}>
      <div className="service-room-heading"><h3>{room}</h3><span>{tables.filter((table) => table.roomName === room).length} bàn</span></div>
      <div className="service-room-list">{tables.filter((table) => table.roomName === room).map((table) => <div className="service-room-item" key={table.id}><span><strong>{table.tableName}</strong><small>{table.isOccupied ? "Đang sử dụng · có đơn tạm tính" : "Đang trống"}</small></span><button className="text-button danger-text" type="button" onClick={() => void removeTable(table)}>Ẩn bàn</button></div>)}</div>
    </section>)}
  </div>;
}
