import { useState } from "react";
import { Icon } from "./Icon";
import { formatMoney, type Product } from "../data/products";

export type MenuItem = Product & {
  sku: string;
  cost: number;
  stock: number;
  menuType: string;
  ingredients: string[];
};

type MenuProductDetailProps = {
  product: MenuItem;
  isNew?: boolean;
  onBack: () => void;
  onSave: (product: MenuItem) => Promise<void>;
};

export function MenuProductDetail({ product, isNew = false, onBack, onSave }: MenuProductDetailProps) {
  const [draft, setDraft] = useState(product);
  const [editing, setEditing] = useState(isNew);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const profit = draft.price - draft.cost;
  const costRate = draft.price ? (draft.cost / draft.price) * 100 : 0;

  const update = (changes: Partial<MenuItem>) => setDraft((current) => ({ ...current, ...changes }));
  const uploadImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveError("Chỉ hỗ trợ tệp hình ảnh.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSaveError("Ảnh phải nhỏ hơn 10 MB.");
      return;
    }
    setSaveError("");
    const reader = new FileReader();
    reader.onerror = () => setSaveError("Không đọc được tệp ảnh.");
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => setSaveError("Tệp ảnh không hợp lệ.");
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        if (dataUrl.length > 1_800_000) {
          setSaveError("Ảnh sau khi xử lý vẫn quá lớn. Hãy chọn ảnh khác.");
          return;
        }
        update({ image: dataUrl });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const save = async () => {
    setIsSaving(true);
    setSaveError("");
    try {
      await onSave(draft);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Không lưu được món.");
    } finally {
      setIsSaving(false);
    }
  };

  return <div className="menu-detail-page page-enter">
    <nav className="menu-detail-nav" aria-label="Điều hướng chi tiết món">
      <button className="menu-detail-back" aria-label="Quay lại thực đơn" onClick={onBack}><Icon name="chevron" size={28} /></button>
      <button className="menu-detail-more" aria-label="Tùy chọn món"><Icon name="menu" size={22} /></button>
    </nav>
    <section className="menu-detail-card">
      <div className="menu-detail-section-heading"><span>THÔNG TIN CƠ BẢN</span><button className="menu-edit-button" disabled={isSaving} onClick={() => editing ? void save() : setEditing(true)}>{isSaving ? "Đang lưu..." : editing ? "Lưu" : "Sửa"}</button></div>
      {saveError && <p role="alert" className="menu-help">{saveError}</p>}
      {editing ? <div className="menu-edit-fields">
        <div className="menu-image-upload">
          <span>Ảnh món</span>
          {draft.image && <img src={draft.image} alt="Xem trước ảnh món" />}
          <label className="menu-image-upload-button">Tải ảnh lên<input type="file" accept="image/*" onChange={(event) => uploadImage(event.target.files?.[0])} /></label>
          <small>Ảnh được thu nhỏ và chuyển sang JPEG trước khi lưu.</small>
        </div>
        <label className="setting-field"><span>Tên món</span><input value={draft.name} onChange={(event) => update({ name: event.target.value })} placeholder="Tên món" /></label>
        <label className="setting-field"><span>Nhóm món</span><input value={draft.category} onChange={(event) => update({ category: event.target.value })} /></label>
        <label className="setting-field"><span>Loại thực đơn</span><input value={draft.menuType} onChange={(event) => update({ menuType: event.target.value })} /></label>
        <label className="setting-field"><span>Giá bán</span><input type="number" min="0" value={draft.price} onChange={(event) => update({ price: Number(event.target.value) })} /></label>
        <label className="setting-field"><span>Giá vốn</span><input type="number" min="0" value={draft.cost} onChange={(event) => update({ cost: Number(event.target.value) })} /></label>
        <label className="setting-field"><span>Tồn kho</span><input type="number" value={draft.stock} onChange={(event) => update({ stock: Number(event.target.value) })} /></label>
      </div> : <>
        <div className="menu-detail-name"><h2>{draft.name}</h2><span>{draft.sku}</span><b>Món thường</b></div>
        <div className="menu-detail-pair"><div><span>Nhóm món</span><strong>{draft.category}</strong></div><div><span>Loại thực đơn</span><strong>{draft.menuType}</strong></div></div>
        <button className="menu-detail-link" onClick={() => setEditing(true)}>Xem chi tiết <Icon name="trend" size={16} /></button>
      </>}
    </section>
    <section className="menu-detail-card">
      <div className="menu-detail-section-heading"><span>GIÁ VÀ THUẾ</span><Icon name="chevron" size={18} /></div>
      <div className="menu-price-grid">
        <div><span>Giá vốn</span><strong>{formatMoney(draft.cost)}</strong></div>
        <div><span>Giá bán</span><strong>{formatMoney(draft.price)}</strong></div>
        <div><span>Lợi nhuận ròng</span><strong>{formatMoney(profit)}</strong></div>
        <div><span>Tỷ lệ giá vốn/giá bán</span><strong>{costRate.toFixed(1)}%</strong></div>
      </div>
      <button className="menu-detail-link" onClick={() => setShowPriceDetails((current) => !current)}>{showPriceDetails ? "Ẩn chi tiết" : "Xem chi tiết"} <Icon name="trend" size={16} /></button>
      {showPriceDetails && <div className="menu-price-extra"><span>Thuế</span><strong>Đã bao gồm trong giá bán</strong></div>}
    </section>
    <section className="menu-detail-card">
      <div className="menu-detail-section-heading"><span>THÀNH PHẦN</span><button className="menu-edit-button" onClick={() => setEditing(true)}>Sửa</button></div>
      {draft.ingredients.length ? <div className="menu-detail-pair"><div><span>Nguyên liệu</span><strong>{draft.ingredients.join(", ")}</strong></div></div> : <p className="menu-empty-note">Chưa khai báo thành phần cho món này.</p>}
    </section>
    <section className="menu-detail-card">
      <div className="menu-detail-section-heading"><span>BẢNG GIÁ</span><button className="menu-edit-button" onClick={() => setEditing(true)}>Sửa</button></div>
      <div className="menu-detail-pair"><div><span>Giá bán</span><strong>{formatMoney(draft.price)}</strong></div><div><span>Áp dụng</span><strong>Tất cả kênh bán</strong></div></div>
    </section>
    <section className="menu-detail-card">
      <div className="menu-detail-section-heading"><span>TỒN KHO CHI NHÁNH HIỆN TẠI</span><Icon name="chevron" size={18} /></div>
      <div className="menu-detail-pair"><div><span>Tồn cuối kỳ</span><strong>{draft.stock}</strong></div><div><span>Chi nhánh</span><strong>Chi nhánh trung tâm</strong></div></div>
    </section>
    {editing && !isNew && <button className="menu-detail-cancel" onClick={() => { setDraft(product); setEditing(false); }}>Hủy chỉnh sửa</button>}
  </div>;
}
