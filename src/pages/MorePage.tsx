import { useState } from "react";
import { logout, type Account } from "../api/auth";
import { Icon, type IconName } from "../components/Icon";

type MoreItem = {
  label: string;
  icon: IconName;
  path: string;
  href?: string;
  roles: Account["role"][];
};

const groups: { title: string; layout: "tiles" | "list"; items: MoreItem[] }[] = [
  {
    title: "Thực đơn",
    layout: "tiles",
    items: [
      { label: "Món", icon: "coffee", path: "/menu", roles: ["owner", "manager"] },
      { label: "Thiết lập giá", icon: "tag", path: "/price-lists", roles: ["owner", "manager"] }
    ],
  },
  {
    title: "Phòng bàn",
    layout: "tiles",
    items: [
      { label: "Phòng bàn", icon: "chair", path: "/tables", roles: ["owner", "manager"] },
    ],
  },
  {
    title: "Hóa đơn",
    layout: "tiles",
    items: [
      { label: "Hóa đơn", icon: "receipt", path: "/invoices", roles: ["owner", "manager", "cashier"] },
    ],
  },
  {
    title: "Kho hàng",
    layout: "tiles",
    items: [
      { label: "Kho hàng", icon: "package", path: "/inventory", roles: ["owner", "manager"] },
      { label: "Kiểm kho", icon: "check", path: "/inventory-check", roles: ["owner", "manager"] },
      { label: "Nhập hàng", icon: "cart", path: "/purchases", roles: ["owner", "manager"] }
    ],
  },
  {
    title: "Khách hàng",
    layout: "tiles",
    items: [{ label: "Khách hàng", icon: "users", path: "/customers", roles: ["owner", "manager"] }],
  },
  {
    title: "Nhân viên",
    layout: "tiles",
    items: [
      { label: "Nhân viên", icon: "user", path: "/employees", roles: ["owner"] },
      { label: "Lịch làm việc", icon: "calendar", path: "/work-schedule", roles: ["owner", "manager", "cashier"] },
      { label: "Bảng lương", icon: "coins", path: "/payroll", roles: ["owner"] },
      { label: "Chấm công", icon: "clock", path: "/attendance", roles: ["owner", "manager", "cashier"] },
      { label: "phiếu giao ca", icon: "handover", path: "/shift-handovers", roles: ["owner", "manager", "cashier"] }
    ],
  },
  {
    title: "Sổ thu chi",
    layout: "tiles",
    items: [
      { label: "Sổ quỹ", icon: "wallet", path: "/cashbook", roles: ["owner", "manager"] },
    ],
  },
  {
    title: "Báo cáo",
    layout: "tiles",
    items: [
      { label: "Phân tích", icon: "trend", path: "/reports/analysis", roles: ["owner", "manager"] },
      { label: "Cuối ngày", icon: "clipboard", path: "/reports/daily", roles: ["owner", "manager", "cashier"] },
      { label: "Hàng hóa", icon: "box", path: "/reports/products", roles: ["owner", "manager"] },
      { label: "Bán hàng", icon: "chart", path: "/reports/sales", roles: ["owner", "manager"] },
    ],
  },
  {
    title: "Cài đặt chung",
    layout: "list",
    items: [
      { label: "Thiết lập cửa hàng", icon: "settings", path: "/settings", roles: ["owner", "manager"] },
      { label: "Lịch sử thao tác", icon: "history", path: "/activity", roles: ["owner", "manager"] },
      { label: "Chat với hỗ trợ", icon: "help", path: "", href: "https://m.me/cngchis", roles: ["owner", "manager", "cashier"] },
    ],
  },
];

const roleLabels: Record<Account["role"], string> = {
  owner: "Chủ cửa hàng",
  manager: "Quản lý",
  cashier: "Thu ngân",
};

export function MorePage({ navigate, onSignOut, account }: { navigate: (path: string) => void; onSignOut: () => void; account: Account }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const initials = account.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("vi-VN");

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

  return <div className="dashboard page-enter more-page">
    <header className="more-page-heading"><h2>Nhiều hơn</h2></header>

    <section className="more-account-card" aria-label="Thông tin tài khoản">
      <div className="more-account-profile">
        <span className="more-account-avatar" aria-hidden="true">{initials || "?"}</span>
        <span className="more-account-copy"><strong>{account.displayName}</strong><span>{roleLabels[account.role]}</span></span>
      </div>
      <div className="more-account-username"><span>Tài khoản</span><strong>{account.username}</strong></div>
    </section>

    <div className="more-groups">
      {groups.map((group) => {
        const visibleItems = group.items.filter((item) => item.roles.includes(account.role));
        if (visibleItems.length === 0) return null;

        return <section className="more-group-card" key={group.title}>
          <h3>{group.title}</h3>
          <div className={group.layout === "tiles" ? "more-items-grid" : "more-items-list"}>
            {visibleItems.map((item) => item.href ? <a className="more-item" key={item.label} href={item.href} target="_blank" rel="noopener noreferrer">
              <span className="more-item-icon"><Icon name={item.icon} size={26} /></span>
              <span className="more-item-label">{item.label}</span>
              {group.layout === "list" && <Icon name="chevron" size={20} />}
            </a> : <button className="more-item" key={item.path} onClick={() => navigate(item.path)}>
              <span className="more-item-icon"><Icon name={item.icon} size={26} /></span>
              <span className="more-item-label">{item.label}</span>
              {group.layout === "list" && <Icon name="chevron" size={20} />}
            </button>)}
          </div>
        </section>;
      })}
    </div>

    <button className="more-sign-out" onClick={handleSignOut} disabled={isSigningOut}>
      <Icon name="logout" size={22} />
      <span>{isSigningOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
    </button>
    {error && <p className="sign-out-error" role="alert">{error}</p>}
  </div>;
}
