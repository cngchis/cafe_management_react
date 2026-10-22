import { useState } from "react";
import { Icon } from "../components/Icon";

const customers = [
  { initials: "NA", name: "Ngọc Anh", phone: "0903 456 789", visits: 18, points: 420, spent: "2.840.000đ", tier: "Thân thiết" },
  { initials: "MT", name: "Minh Tú", phone: "0912 345 678", visits: 12, points: 285, spent: "1.960.000đ", tier: "Thân thiết" },
  { initials: "HL", name: "Hoàng Linh", phone: "0987 654 321", visits: 7, points: 140, spent: "980.000đ", tier: "Thành viên" },
  { initials: "PQ", name: "Phương Quỳnh", phone: "0908 112 233", visits: 4, points: 80, spent: "540.000đ", tier: "Thành viên" },
  { initials: "TB", name: "Thanh Bình", phone: "0934 567 890", visits: 1, points: 20, spent: "132.000đ", tier: "Mới" },
];

export function CustomersPage() {
  const [query, setQuery] = useState("");
  const visibleCustomers = customers.filter((customer) => `${customer.name} ${customer.phone}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome">
      <div><span className="eyebrow">THÀNH VIÊN</span><h2>Khách hàng</h2><p>Thông tin và lịch sử gắn bó của khách hàng.</p></div>
      <strong className="management-count">{customers.length} khách hàng</strong>
    </section>
    <div className="management-toolbar"><label className="search-box"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc số điện thoại..." /></label></div>
    <article className="panel orders-panel">
      <div className="panel-heading"><div><h3>Danh sách khách hàng</h3><p>{visibleCustomers.length} kết quả</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>SỐ ĐIỆN THOẠI</th><th>LƯỢT ĐẾN</th><th>ĐIỂM</th><th>TỔNG CHI TIÊU</th><th>HẠNG</th></tr></thead><tbody>
        {visibleCustomers.map((customer) => <tr key={customer.phone}><td><div className="customer-name"><span>{customer.initials}</span><strong>{customer.name}</strong></div></td><td>{customer.phone}</td><td>{customer.visits}</td><td>{customer.points}</td><td><strong>{customer.spent}</strong></td><td><span className="status done">{customer.tier}</span></td></tr>)}
      </tbody></table>{!visibleCustomers.length && <div className="management-empty">Không tìm thấy khách hàng.</div>}</div>
    </article>
  </div>;
}