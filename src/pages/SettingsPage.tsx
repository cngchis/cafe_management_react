import { useState } from "react";
import { Icon } from "../components/Icon";

export function SettingsPage() {
  const [storeName, setStoreName] = useState("CỘI Coffee & Beer");
  const [phone, setPhone] = useState("0901 234 567");
  const [serviceFee, setServiceFee] = useState("5");
  const [notifications, setNotifications] = useState(true);
  const [saved, setSaved] = useState(false);

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
  </div>;
}