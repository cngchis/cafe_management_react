import { useState } from "react";
import { Icon } from "../components/Icon";
import { resetOperationalData } from "../api/dataReset";
import type { Account } from "../api/auth";

export function SettingsPage({ role }: { role: Account["role"] }) {
  const [storeName, setStoreName] = useState("CỘI Coffee & Beer");
  const [phone, setPhone] = useState("0901 234 567");
  const [serviceFee, setServiceFee] = useState("5");
  const [notifications, setNotifications] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    setResetError("");
    try {
      await resetOperationalData();
      setShowResetDialog(false);
      setResetConfirmation("");
      setResetSuccess(true);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Không thể xóa dữ liệu. Vui lòng thử lại.");
    } finally {
      setIsResetting(false);
    }
  }

  return <div className="dashboard page-enter">
    <section className="welcome management-welcome">
      <div><span className="eyebrow">CỬA HÀNG</span><h2>Cài đặt</h2><p>Thông tin cơ bản và tùy chọn vận hành.</p></div>
    </section>
    <form className="settings-card panel" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
      <div className="panel-heading"><div><h3>Thông tin cửa hàng</h3><p>Cập nhật thông tin hiển thị trên hóa đơn.</p></div></div>
      <div className="settings-fields">
        <label className="setting-field"><span>Tên cửa hàng</span><input value={storeName} onChange={(event) => { setStoreName(event.target.value); setSaved(false); }} /></label>
        <label className="setting-field"><span>Số điện thoại</span><input value={phone} onChange={(event) => { setPhone(event.target.value); setSaved(false); }} /></label>
        <label className="setting-field"><span>Phí dịch vụ (%)</span><input type="number" min="0" max="100" value={serviceFee} onChange={(event) => { setServiceFee(event.target.value); setSaved(false); }} /></label>
        <label className="setting-toggle"><span><strong>Thông báo đơn hàng</strong><small>Nhận thông báo khi có đơn mới.</small></span><input type="checkbox" checked={notifications} onChange={(event) => setNotifications(event.target.checked)} /></label>
      </div>
      <div className="settings-footer"><span role="status">{saved && <><Icon name="check" size={16} /> Đã lưu thay đổi</>}</span><button className="primary-button" type="submit">Lưu cài đặt</button></div>
    </form>
    {role === "owner" && <details className="settings-card panel settings-reset-card">
      <summary><strong>Tùy chọn dữ liệu nâng cao</strong><span>Xóa dữ liệu vận hành</span></summary>
      <div className="settings-reset-content">
        <div className="panel-heading"><div><h3>Xóa dữ liệu vận hành</h3><p>Xóa danh sách món, đơn hàng, hóa đơn, thanh toán, lịch sử tồn kho, sổ quỹ và lịch làm việc.</p></div></div>
        <p className="settings-reset-retained">Tài khoản nhân viên, tài khoản đăng nhập và thông tin cửa hàng được giữ lại.</p>
        {resetSuccess && <p className="settings-reset-success" role="status">Đã xóa dữ liệu vận hành.</p>}
        <div className="settings-footer"><span /><button className="settings-reset-button" type="button" onClick={() => { setResetError(""); setShowResetDialog(true); }}>Xóa toàn bộ dữ liệu</button></div>
      </div>
    </details>}
    {showResetDialog && <div className="settings-reset-backdrop" onClick={() => { if (!isResetting) setShowResetDialog(false); }}>
      <section className="settings-reset-dialog" role="alertdialog" aria-modal="true" aria-labelledby="settings-reset-title" onClick={(event) => event.stopPropagation()}>
        <h3 id="settings-reset-title">Xóa toàn bộ dữ liệu vận hành?</h3>
        <p>Thao tác này không thể hoàn tác. Danh sách món, đơn hàng/hóa đơn, thanh toán, lịch sử tồn kho, sổ quỹ và lịch làm việc sẽ bị xóa.</p>
        <p><strong>Tài khoản và thông tin cửa hàng sẽ được giữ lại.</strong></p>
        <label className="settings-reset-confirm-label">Nhập <strong>XÓA DỮ LIỆU</strong> để xác nhận
          <input autoFocus value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} />
        </label>
        {resetError && <p className="menu-detail-sheet-error" role="alert">{resetError}</p>}
        <div className="menu-detail-sheet-actions">
          <button className="menu-detail-sheet-secondary" type="button" disabled={isResetting} onClick={() => setShowResetDialog(false)}>Hủy</button>
          <button className="menu-detail-sheet-danger" type="button" disabled={isResetting || resetConfirmation !== "XÓA DỮ LIỆU"} onClick={() => void handleReset()}>{isResetting ? "Đang xóa…" : "Xóa dữ liệu"}</button>
        </div>
      </section>
    </div>}
  </div>;
}
