import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "./components/Icon";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { PosPage } from "./pages/PosPage";
import { MenuPage } from "./pages/MenuPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { CustomersPage } from "./pages/CustomersPage";
import { MorePage } from "./pages/MorePage";
import { SettingsPage } from "./pages/SettingsPage";
import { CashbookPage } from "./pages/CashbookPage";
import { LoginPage } from "./pages/LoginPage";
import { InventoryCheckPage } from "./pages/InventoryCheckPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { WorkSchedulePage } from "./pages/WorkSchedulePage";
import { PayrollPage } from "./pages/PayrollPage";
import { getCurrentAccount, type Account } from "./api/auth";
import { canAccessPath, landingPath } from "./auth/permissions";

function Header({ title }: { title: string }) {
  return <header className="topbar">
    <div className="topbar-title"><div><p>Thứ sáu, 20 tháng 6</p><h1>{title}</h1></div></div>
    <div className="top-actions"><div className="store-status"><span></span>Đang mở cửa</div><button className="icon-button notification" aria-label="Thông báo"><Icon name="bell" /><i></i></button><div className="avatar small">AN</div></div>
  </header>;
}

const pathsByView: Record<string, string> = {
  "Tổng quan": "/",
  "Thu ngân": "/pos",
  "Món": "/menu",
  "Nhân viên": "/employees",
  "Lịch làm việc": "/work-schedule",
  "Bảng tính lương": "/payroll",
  "Kiểm kho": "/inventory-check",
  "Hóa đơn": "/invoices",
  "Sổ quỹ": "/cashbook",
  "Khách hàng": "/customers",
  "Nhiều hơn": "/more",
  "Cài đặt": "/settings",
};

function AppShell({ account, onSignIn, onSignOut }: { account: Account | null; onSignIn: (account: Account) => void; onSignOut: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  if (!account) return <LoginPage onSignIn={(destination, signedInAccount) => { onSignIn(signedInAccount); navigate(landingPath(signedInAccount.role, destination)); }} />;
  if (location.pathname === "/login") return <Navigate to="/" replace />;
  if (!canAccessPath(account.role, location.pathname)) return <Navigate to={account.role === "cashier" ? "/pos" : "/"} replace />;
  return <div className="app-shell">
    <Sidebar account={account} activePath={location.pathname} navigate={navigate} />
    <main className="main-area">
      {/* <div className="view-switcher"><button className={view !== "Thu ngân" ? "active" : ""} onClick={() => setView("Tổng quan")}><Icon name="grid" size={17} /> Quản lý</button><button className={view === "Thu ngân" ? "active" : ""} onClick={() => setView("Thu ngân")}><Icon name="receipt" size={17} /> Thu ngân</button></div> */}
      <Routes>
        <Route path="/" element={<DashboardPage goPos={() => navigate(pathsByView["Thu ngân"])} />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/work-schedule" element={<WorkSchedulePage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/inventory-check" element={<InventoryCheckPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/cashbook" element={<CashbookPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/more" element={<MorePage navigate={navigate} onSignOut={onSignOut} account={account} />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>;
}

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    getCurrentAccount()
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setIsLoadingSession(false));
  }, []);

  if (isLoadingSession) return <div role="status" aria-live="polite">Đang kiểm tra phiên đăng nhập…</div>;

  return <BrowserRouter><AppShell account={account} onSignIn={setAccount} onSignOut={() => setAccount(null)} /></BrowserRouter>;
}
