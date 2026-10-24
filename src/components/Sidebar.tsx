import { Icon, type IconName } from "./Icon";
import { canAccessPath } from "../auth/permissions";
import type { Account } from "../api/auth";

const navigation = [
  { label: "Tổng quan", icon: "chart" as IconName, path: "/" },
  { label: "Món", icon: "coffee" as IconName, path: "/menu" },
  { label: "Bán hàng", icon: "cart" as IconName, path: "/pos" },
  { label: "Hóa đơn", icon: "receipt" as IconName, path: "/invoices" },
  { label: "Nhiều hơn", icon: "menu" as IconName, path: "/more" }
];

function Brand() {
  return <div className="brand"><div className="brand-mark"><Icon name="coffee" size={22} /></div><div><strong>CỘI</strong><span>COFFEE & BEER</span></div></div>;
}

const roleLabels: Record<Account["role"], string> = { owner: "Chủ cửa hàng", manager: "Quản lý", cashier: "Thu ngân" };

export function Sidebar({ account, activePath, navigate }: { account: Account; activePath: string; navigate: (path: string) => void }) {
  const role = account.role;
  return <aside className="sidebar">
    <div className="sidebar-top"><Brand /></div>
    <nav className="nav-list" aria-label="Điều hướng chính">
      {navigation.filter((item) => canAccessPath(role, item.path)).map((item) => <button key={item.path} className={`nav-item ${item.path === "/" ? "overview-nav" : ""} ${activePath === item.path ? "active" : ""}`} onClick={() => navigate(item.path)}>
        <Icon name={item.icon} /><span>{item.label}</span>
      </button>)}
    </nav>
    <div className="sidebar-bottom">
      {canAccessPath(role, "/settings") && <button className={`nav-item ${activePath === "/settings" ? "active" : ""}`} onClick={() => navigate("/settings")}><Icon name="settings" /><span>Cài đặt</span></button>}
      <div className="user-card"><div className="avatar">{account.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{account.displayName}</strong><span>{roleLabels[role]}</span></div></div>
    </div>
  </aside>;
}
