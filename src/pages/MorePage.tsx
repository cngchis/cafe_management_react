import { useState } from "react";
import { logout, type Account } from "../api/auth";
import { Icon, type IconName } from "../components/Icon";

const shortcuts: { label: string; description: string; icon: IconName; path: string; roles: Account["role"][] }[] = [
  { label: "Món", description: "Danh mục và giá bán", icon: "coffee", path: "/menu", roles: ["owner", "manager"] },
  { label: "Nhân viên", description: "Tài khoản, vai trò và đơn giá theo giờ", icon: "users", path: "/employees", roles: ["owner"] },
  { label: "Lịch làm việc", description: "Bảng lịch tuần và chia ca", icon: "calendar", path: "/work-schedule", roles: ["owner"] },
  { label: "Bảng tính lương", description: "Tổng hợp lương theo tháng và xuất Excel", icon: "wallet", path: "/payroll", roles: ["owner"] },
  { label: "Kiểm kho", description: "Đếm tồn và đối soát chênh lệch", icon: "receipt", path: "/inventory-check", roles: ["owner", "manager"] },
  { label: "Hóa đơn", description: "Đơn hàng và thanh toán", icon: "receipt", path: "/invoices", roles: ["owner", "manager", "cashier"] },
  { label: "Sổ quỹ", description: "Số dư và giao dịch thu chi", icon: "wallet", path: "/cashbook", roles: ["owner", "manager"] },
  { label: "Khách hàng", description: "Thành viên và điểm thưởng", icon: "users", path: "/customers", roles: ["owner", "manager"] },
  { label: "Cài đặt", description: "Thông tin cửa hàng", icon: "settings", path: "/settings", roles: ["owner", "manager"] },
];

export function MorePage({ navigate, onSignOut, role }: { navigate: (path: string) => void; onSignOut: () => void; role: Account["role"] }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError("");
    try {
      await logout();
      onSignOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Đăng xuất thất bại. Vui lòng thử lại.");
      setIsSigningOut(false);
    }
  };

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome">
      <div><span className="eyebrow">CỘI COFFEE & BEER</span><h2>Nhiều hơn</h2><p>Truy cập nhanh các khu vực quản lý.</p></div>
    </section>
    <section className="shortcut-grid" aria-label="Lối tắt quản lý">
      {shortcuts.filter((item) => item.roles.includes(role)).map((item) => <button className="shortcut-card" key={item.path} onClick={() => navigate(item.path)}>
        <span className="shortcut-icon"><Icon name={item.icon} /></span><span className="shortcut-copy"><strong>{item.label}</strong><small>{item.description}</small></span><Icon name="chevron" size={18} />
      </button>)}
      <button className="shortcut-card sign-out-card" onClick={handleSignOut} disabled={isSigningOut}>
        <span className="shortcut-icon"><Icon name="close" /></span><span className="shortcut-copy"><strong>{isSigningOut ? "Đang đăng xuất…" : "Đăng xuất"}</strong><small>Kết thúc phiên đăng nhập hiện tại</small></span><Icon name="chevron" size={18} />
      </button>
    </section>
    {error && <p className="sign-out-error" role="alert">{error}</p>}
  </div>;
}
