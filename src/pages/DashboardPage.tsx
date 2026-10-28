import { useEffect, useState } from "react";
import { Icon, type IconName } from "../components/Icon";
import { formatMoney } from "../data/products";
import { getDashboardSummary, type DashboardSummary } from "../api/dashboard";
import { getActivity, type ActivityRecord } from "../api/moreOperations";

function StatCard({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: IconName; tone: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon name={icon} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small><b><Icon name="trend" size={13} /> {note}</b> so với hôm qua</small></div></article>;
}

function changeLabel(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0%" : "Mới";
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function compactAmount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function orderLocation(order: DashboardSummary["recentOrders"][number]) {
  if (order.orderType === "dine_in") return order.serviceLocation || "Tại bàn";
  if (order.orderType === "delivery") return "Giao hàng";
  return "Mang đi";
}

export function DashboardPage({ goPos, canViewActivity = true }: { goPos: () => void; canViewActivity?: boolean }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const loadSummary = async () => {
    setIsLoading(true);
    setError("");
    try {
      setSummary(await getDashboardSummary());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu tổng quan.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadSummary(); }, []);

  const openActivity = async () => {
    setActivityOpen(true);
    setActivityLoading(true);
    setActivityError("");
    try { setActivity((await getActivity()).events.slice(0, 12)); }
    catch (cause) { setActivityError(cause instanceof Error ? cause.message : "Không tải được lịch sử thao tác."); }
    finally { setActivityLoading(false); }
  };

  const today = summary?.today;
  const yesterday = summary?.yesterday;
  const maxRevenue = Math.max(1, ...(summary?.weeklyRevenue.map((day) => day.revenueVnd) ?? []));
  const axisTop = Math.ceil(maxRevenue / 1_000_000) * 1_000_000 || 1_000_000;
  const axisLabels = [axisTop, axisTop * .75, axisTop * .5, axisTop * .25, 0];

  return <div className="dashboard page-enter">
    <section className="welcome">
      <div><span className="eyebrow"><Icon name="spark" size={15} /> TỔNG QUAN HÔM NAY</span><h2>Hoạt động cửa hàng</h2><p>{today?.orderCount ?? 0} đơn hoàn tất · {formatMoney(today?.revenueVnd ?? 0)} doanh thu.</p></div>
      <div className="dashboard-welcome-actions">
        {canViewActivity && <button className="dashboard-notifications-button" type="button" aria-label="Thông báo và lịch sử thao tác" title="Thông báo" onClick={() => void openActivity()}><Icon name="bell" size={19} /></button>}
        <button className="primary-button" onClick={goPos}><Icon name="plus" /> Tạo đơn hàng</button>
      </div>
    </section>
    {error && <div className="dashboard-data-error" role="alert"><span>{error}</span><button type="button" onClick={() => void loadSummary()}>Thử lại</button></div>}
    <section className="stats-grid" aria-busy={isLoading}>
      <StatCard label="Doanh thu hôm nay" value={today ? formatMoney(today.revenueVnd) : "—"} note={today && yesterday ? changeLabel(today.revenueVnd, yesterday.revenueVnd) : "—"} icon="wallet" tone="orange" />
      <StatCard label="Đơn hoàn tất" value={today ? String(today.orderCount) : "—"} note={today && yesterday ? changeLabel(today.orderCount, yesterday.orderCount) : "—"} icon="receipt" tone="green" />
      <StatCard label="Giá trị trung bình" value={today ? formatMoney(today.averageOrderVnd) : "—"} note={today && yesterday ? changeLabel(today.averageOrderVnd, yesterday.averageOrderVnd) : "—"} icon="chart" tone="violet" />
      <StatCard label="Món đã bán" value={today ? String(today.itemCount) : "—"} note={today && yesterday ? changeLabel(today.itemCount, yesterday.itemCount) : "—"} icon="coffee" tone="blue" />
    </section>
    <section className="dashboard-grid">
      <article className="panel revenue-panel">
        <div className="panel-heading"><div><h3>Doanh thu thuần</h3><p>7 ngày gần nhất · theo ngày Việt Nam</p></div><button className="select-button" type="button">7 ngày qua <Icon name="chevron" size={15} /></button></div>
        <div className="chart-wrap">
          <div className="y-labels">{axisLabels.map((value, index) => <span key={index}>{compactAmount(value)}</span>)}</div>
          <div className="bars">
            {(summary?.weeklyRevenue ?? []).map((day, index, days) => {
              const date = new Date(`${day.day}T12:00:00+07:00`);
              const label = new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
              return <div className="bar-col" key={day.day} title={`${day.day}: ${formatMoney(day.revenueVnd)}`}>
                <div className={`bar ${index === days.length - 1 ? "bar-active" : ""}`} style={{ height: `${Math.max(3, day.revenueVnd / axisTop * 100)}%` }}>{index === days.length - 1 && <span>{compactAmount(day.revenueVnd)}</span>}</div>
                <small>{label}</small>
              </div>;
            })}
          </div>
        </div>
      </article>
      <article className="panel best-sellers">
        <div className="panel-heading"><div><h3>Món bán chạy</h3><p>Top sản phẩm hôm nay</p></div><button className="text-button" type="button">Xem tất cả</button></div>
        <div className="best-list">
          {(summary?.bestSellers ?? []).map((product, index) => <div className="best-item" key={`${product.productId}-${product.name}`}>
            <span className="rank">0{index + 1}</span><img src={product.imageUrl || ""} alt="" />
            <div><strong>{product.name}</strong><span>{product.quantitySold} lượt bán</span></div><b>{formatMoney(product.revenueVnd)}</b>
          </div>)}
          {!isLoading && !error && !summary?.bestSellers.length && <div className="management-empty">Chưa có món bán hôm nay.</div>}
        </div>
      </article>
    </section>
    <article className="panel orders-panel dashboard-orders-panel">
      <div className="panel-heading"><div><h3>Đơn hàng gần đây</h3><p>Đơn đã thanh toán, mới nhất trước</p></div><button className="text-button" type="button">Xem tất cả <Icon name="chevron" size={14} /></button></div>
      <div className="table-wrap"><table><thead><tr><th>MÃ ĐƠN</th><th>VỊ TRÍ</th><th>SỐ MÓN</th><th>TỔNG TIỀN</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>
        {(summary?.recentOrders ?? []).map((order) => <tr key={order.id}>
          <td><strong>{order.orderNumber}</strong></td><td>{orderLocation(order)}</td><td>{order.itemCount} món</td><td><strong>{formatMoney(order.totalVnd)}</strong></td><td><span className="status done">Hoàn thành</span></td><td><button className="row-action" type="button" aria-label={`Xem đơn ${order.orderNumber}`}><Icon name="chevron" size={16} /></button></td>
        </tr>)}
        {!isLoading && !error && !summary?.recentOrders.length && <tr><td colSpan={6}>Chưa có đơn hàng đã thanh toán.</td></tr>}
      </tbody></table></div>
    </article>
    {activityOpen && <div className="dashboard-notifications-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivityOpen(false); }}><section className="dashboard-notifications-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboard-notifications-title">
      <header><div><h3 id="dashboard-notifications-title">Thông báo</h3><p>Lịch sử thao tác gần đây</p></div><button className="icon-button" type="button" aria-label="Đóng thông báo" onClick={() => setActivityOpen(false)}><Icon name="close" size={18} /></button></header>
      {activityLoading && <p className="management-empty" role="status">Đang tải lịch sử thao tác...</p>}
      {activityError && <div className="dashboard-notifications-error" role="alert">{activityError}<button className="text-button" type="button" onClick={() => void openActivity()}>Thử lại</button></div>}
      {!activityLoading && !activityError && activity.length === 0 && <p className="management-empty">Chưa có thao tác nào được ghi nhận.</p>}
      {!activityLoading && !activityError && activity.map((event) => <article className="dashboard-notification-row" key={event.id}><span className="activity-dot" aria-hidden="true" /><div><strong>{event.summary}</strong><small>{event.actorName}</small></div><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</time></article>)}
    </section></div>}
  </div>;
}
