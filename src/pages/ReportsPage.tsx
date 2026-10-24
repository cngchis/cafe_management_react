import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getReports, type ReportData } from "../api/moreOperations";
import { formatMoney } from "../data/products";

const dateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const titles: Record<string, string> = { analysis: "Báo cáo phân tích", daily: "Báo cáo cuối ngày", products: "Báo cáo hàng hóa", sales: "Báo cáo bán hàng" };
const methodNames: Record<string, string> = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", card: "Thẻ", other: "Khác", credit: "Công nợ" };
const orderNames: Record<string, string> = { dine_in: "Tại bàn", takeaway: "Mang về", delivery: "Giao đi", staff: "Nội bộ" };

export function ReportsPage() {
  const { kind = "analysis" } = useParams();
  const reportKind = titles[kind] ? kind : "analysis";
  const [from, setFrom] = useState(() => dateInput(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(() => dateInput(new Date()));
  const [data, setData] = useState<ReportData | null>(null);
  const [tab, setTab] = useState("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true; setLoading(true);
    getReports(from, to).then((result) => { if (active) { setData(result); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được báo cáo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const summary = data?.summary;
  const maxRevenue = Math.max(1, ...(data?.daily.map((row) => row.revenueVnd) ?? [1]));
  const tabs = [{ id: "summary", label: "Tổng hợp" }, { id: "cash", label: "Thu chi" }, { id: "goods", label: "Hàng hóa" }, { id: "orders", label: "Phòng bàn" }];

  return <div className="dashboard page-enter report-page">
    <section className="welcome management-welcome"><div><span className="eyebrow">BÁO CÁO</span><h2>{titles[reportKind]}</h2><p>Số liệu tổng hợp trực tiếp từ hóa đơn, thanh toán, sổ quỹ và tồn kho.</p></div></section>
    <section className="panel report-controls"><label className="setting-field"><span>Từ ngày</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="setting-field"><span>Đến ngày</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><span className="report-single-store">Một cửa hàng · VND</span></section>
    {error && <p className="menu-help" role="alert">{error}</p>}
    {loading && <section className="panel management-empty" role="status">Đang tổng hợp dữ liệu…</section>}
    {!loading && summary && <>
      {reportKind === "daily" && <nav className="report-tabs" aria-label="Nhóm báo cáo">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>}
      {(reportKind === "analysis" || reportKind === "sales" || reportKind === "daily" && tab === "summary") && <>
        <section className="report-metrics">
          <article><span>Doanh thu thuần</span><strong>{formatMoney(summary.revenueVnd)}</strong><small>{summary.invoiceCount} hóa đơn hoàn thành</small></article>
          <article><span>Giá vốn hàng bán</span><strong>{formatMoney(summary.cogsVnd)}</strong><small>{summary.itemsSold} món đã bán</small></article>
          <article><span>Lợi nhuận gộp</span><strong>{formatMoney(summary.grossProfitVnd)}</strong><small>Doanh thu trừ giá vốn</small></article>
          <article><span>Lợi nhuận sau chi phí</span><strong>{formatMoney(summary.netProfitVnd)}</strong><small>Đã trừ chi phí sổ quỹ</small></article>
        </section>
        <section className="panel report-panel"><div className="panel-heading"><div><h3>Kinh doanh theo ngày</h3><p>Doanh thu thuần, giá vốn và lợi nhuận gộp</p></div></div>
          <div className="report-chart" role="img" aria-label="Biểu đồ doanh thu theo ngày">
            {data?.daily.map((row) => <div className="report-chart-column" key={row.day} title={`${row.day}: doanh thu ${formatMoney(row.revenueVnd)}, giá vốn ${formatMoney(row.cogsVnd)}`}>
              <div className="report-chart-bars"><i style={{ height: `${Math.max(2, row.revenueVnd / maxRevenue * 100)}%` }} /><i className="cost" style={{ height: `${Math.max(2, row.cogsVnd / maxRevenue * 100)}%` }} /></div>
              <span>{new Date(`${row.day}T12:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</span>
            </div>)}
          </div>
        </section>
      </>}
      {(reportKind === "products" || reportKind === "daily" && tab === "goods") && <section className="panel report-panel"><div className="panel-heading"><div><h3>{reportKind === "products" ? "Hàng bán chạy" : "Món đã bán"}</h3><p>Sắp xếp theo doanh thu trong khoảng thời gian đã chọn</p></div></div>
        <div className="report-table">{data?.products.map((item) => <div className="report-product-row" key={item.name}><span><strong>{item.name}</strong><small>{item.quantitySold} món · tồn hiện tại {item.currentStock.toLocaleString("vi-VN")}</small></span><span><strong>{formatMoney(item.revenueVnd)}</strong><small>Giá vốn {formatMoney(item.cogsVnd)}</small></span></div>)}{!data?.products.length && <p className="management-empty">Chưa có món bán trong khoảng thời gian này.</p>}</div>
      </section>}
      {(reportKind === "daily" && tab === "cash" || reportKind === "sales") && <section className="panel report-panel"><div className="panel-heading"><div><h3>Thu chi và phương thức thanh toán</h3><p>Ghi nợ đang chờ thanh toán được hiển thị riêng.</p></div></div>
        <div className="report-table">{data?.payments.map((payment) => <div className="report-metric-row" key={payment.method}><span>{methodNames[payment.method] ?? payment.method} · {payment.count} giao dịch</span><strong>{formatMoney(payment.amountVnd)}</strong></div>)}
          <div className="report-metric-row"><span>Chi phí vận hành (sổ quỹ)</span><strong>{formatMoney(summary.operatingExpenseVnd)}</strong></div>
          <div className="report-metric-row"><span>Hóa đơn đã hủy · {summary.cancelledCount}</span><strong>{formatMoney(summary.cancelledVnd)}</strong></div>
        </div>
      </section>}
      {(reportKind === "daily" && tab === "orders" || reportKind === "sales") && <section className="panel report-panel"><div className="panel-heading"><div><h3>Doanh thu theo loại đơn</h3><p>Chỉ tính hóa đơn hoàn thành</p></div></div>
        <div className="report-table">{data?.orderTypes.map((item) => <div className="report-metric-row" key={item.type}><span>{orderNames[item.type] ?? item.type} · {item.count} đơn</span><strong>{formatMoney(item.revenueVnd)}</strong></div>)}{!data?.orderTypes.length && <p className="management-empty">Chưa có hóa đơn trong khoảng thời gian này.</p>}</div>
      </section>}
      {reportKind === "daily" && tab === "summary" && <section className="panel report-panel"><div className="panel-heading"><div><h3>Tổng kết hóa đơn</h3></div></div><div className="report-metric-row"><span>Số hóa đơn</span><strong>{summary.invoiceCount}</strong></div><div className="report-metric-row"><span>Đơn đã hủy</span><strong>{summary.cancelledCount} · {formatMoney(summary.cancelledVnd)}</strong></div></section>}
      {(reportKind === "daily" && tab === "cash" || reportKind === "analysis") && <section className="panel report-panel"><div className="panel-heading"><div><h3>Chi tiết thu chi theo ngày</h3><p>Chi phí vận hành không bao gồm khoản nhập hàng.</p></div></div>{data?.daily.map((row) => <div className="report-metric-row" key={row.day}><span>{new Date(`${row.day}T12:00:00`).toLocaleDateString("vi-VN")} · chi vận hành {formatMoney(row.operatingExpenseVnd)} · nhập hàng {formatMoney(row.purchaseOutflowVnd)}</span><strong>{formatMoney(row.revenueVnd)}</strong></div>)}</section>}
    </>}
    {reportKind === "daily" && tab === "goods" && <section className="panel report-panel"><div className="panel-heading"><div><h3>Tồn kho hiện tại</h3><p>Tồn kho tính từ toàn bộ biến động nhập, bán và kiểm kho.</p></div></div>{data?.inventory.map((item) => <div className="report-metric-row" key={item.id}><span>{item.name}<small>{item.sku}</small></span><strong>{item.stock.toLocaleString("vi-VN", { maximumFractionDigits: 3 })}</strong></div>)}</section>}
    {data && <p className="report-data-note">Giá vốn của hóa đơn trước khi có lưu giá vốn theo dòng được ước tính bằng giá vốn hiện có tại thời điểm migration.</p>}
  </div>;
}
