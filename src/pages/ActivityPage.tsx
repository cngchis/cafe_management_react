import { useEffect, useState } from "react";
import { getActivity, type ActivityRecord } from "../api/moreOperations";

const labels: Record<string, string> = { created: "Đã tạo", cancelled: "Đã hủy", deactivated: "Đã ngừng", updated: "Đã cập nhật" };

export function ActivityPage() {
  const [events, setEvents] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    getActivity().then((result) => setEvents(result.events))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Không tải được lịch sử thao tác."))
      .finally(() => setLoading(false));
  }, []);

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome"><div><span className="eyebrow">CÀI ĐẶT CHUNG</span><h2>Lịch sử thao tác</h2><p>Nhật ký hóa đơn, mặt hàng và các nghiệp vụ được ghi nhận từ thời điểm bật tính năng.</p></div></section>
    {error && <p className="menu-help" role="alert">{error}</p>}
    <section className="panel activity-panel"><div className="panel-heading"><div><h3>Hoạt động gần đây</h3><p>300 thao tác gần nhất</p></div></div>
      {loading && <p className="management-empty">Đang tải lịch sử…</p>}
      {!loading && !events.length && <p className="management-empty">Chưa có thao tác nào được ghi nhận.</p>}
      {events.map((event) => <article className="activity-row" key={event.id}><span className="activity-dot" aria-hidden="true" /><span><strong>{event.summary}</strong><small>{labels[event.action] ?? event.action} · {event.actorName}</small></span><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</time></article>)}
    </section>
  </div>;
}
