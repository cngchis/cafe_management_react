import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getServiceTables, type ServiceTable } from "../api/serviceTables";
import { Icon } from "../components/Icon";

type StatusFilter = "all" | "occupied" | "empty";
type TypeFilter = "all" | "takeaway" | "table";

export function PosTableSelectionPage() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<ServiceTable[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try { setTables(await getServiceTables()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được danh sách phòng bàn."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const visibleTables = useMemo(() => tables.filter((table) =>
    (status === "all" || (status === "occupied" ? table.isOccupied : !table.isOccupied)),
  ), [tables, status]);
  const startOrder = (orderType: "takeaway" | "delivery" | "dine_in", serviceLocation?: string) => {
    const params = new URLSearchParams({ sell: "1", orderType });
    if (serviceLocation) params.set("serviceLocation", serviceLocation);
    navigate(`/pos?${params.toString()}`);
  };

  return <div className="pos-table-selection page-enter">
    <header className="pos-table-selection-header"><div className="pos-table-brand"><span><Icon name="coffee" size={21} /></span><strong>CỘI</strong></div><div><p className="eyebrow">BÁN HÀNG</p><h2>Chọn phòng bàn</h2></div><button type="button" className="icon-button" onClick={() => navigate("/more")} aria-label="Mở menu"><Icon name="menu" size={22} /></button></header>
    <div className="pos-table-status-tabs" role="tablist" aria-label="Lọc trạng thái bàn">
      {([{ id: "all", label: "Tất cả" }, { id: "occupied", label: "Sử dụng" }, { id: "empty", label: "Còn trống" }] as const).map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={status === tab.id} className={status === tab.id ? "active" : ""} onClick={() => setStatus(tab.id)}>{tab.label}{tab.id !== "all" && <span>{tables.filter((table) => tab.id === "occupied" ? table.isOccupied : !table.isOccupied).length}</span>}</button>)}
    </div>
    <div className="pos-table-filters" aria-label="Lọc loại đơn">
      {([{ id: "takeaway", label: "MANG VỀ" }, { id: "table", label: "BÀN" }] as const).map((filter) => <button key={filter.id} type="button" className={type === filter.id ? "active" : ""} onClick={() => setType(type === filter.id ? "all" : filter.id)}>{filter.label}</button>)}
    </div>
    {error && <div className="management-error" role="alert"><span>{error}</span><button type="button" className="text-button" onClick={() => void refresh()}>Thử lại</button></div>}
    {loading ? <p className="management-empty" role="status">Đang tải danh sách phòng bàn...</p> : <div className="pos-service-grid">
      {(type === "all" || type === "takeaway") && <>
        <button type="button" className="pos-service-card pos-service-quick" onClick={() => startOrder("takeaway")}><span className="pos-service-title"><Icon name="cart" size={21} />Mang về</span><small>Tạo đơn mang đi</small></button>
        {type === "all" && <button type="button" className="pos-service-card pos-service-quick" onClick={() => startOrder("delivery")}><span className="pos-service-title"><Icon name="store" size={21} />Giao đi</span><small>Tạo đơn giao hàng</small></button>}
      </>}
      {(type === "all" || type === "table") && visibleTables.map((table) => <button type="button" key={table.id} className={`pos-service-card ${table.isOccupied ? "occupied" : ""}`} onClick={() => table.activeOrderId ? navigate(`/pos?estimateId=${encodeURIComponent(table.activeOrderId)}`) : startOrder("dine_in", `${table.roomName} · ${table.tableName}`)}>
        <span className="pos-service-title"><Icon name="store" size={20} />{table.tableName}</span><small>{table.roomName}</small><span className="pos-service-status">{table.isOccupied ? "Đang sử dụng · Mở đơn" : "Còn trống"}</span>
      </button>)}
      {(type === "all" || type === "table") && !visibleTables.length && <p className="management-empty pos-no-tables">{tables.length ? "Không có bàn phù hợp với trạng thái đã chọn." : "Chưa có bàn. Quản lý có thể tạo bàn trong Menu > Nhiều hơn > Phòng bàn."}</p>}
    </div>}
  </div>;
}
