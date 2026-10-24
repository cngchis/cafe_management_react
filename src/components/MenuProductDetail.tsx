import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  onDelete: (id: string) => Promise<void>;
};

export function MenuProductDetail({ product, isNew = false, onBack, onSave, onDelete }: MenuProductDetailProps) {
  const [draft, setDraft] = useState(product);
  const [editing, setEditing] = useState(isNew);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const sheetRef = useRef<HTMLElement>(null);
  const profit = draft.price - draft.cost;
  const costRate = draft.price ? (draft.cost / draft.price) * 100 : 0;

  useEffect(() => {
    if (!menuOpen) return;
    const focusableElements = () => Array.from(sheetRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
    focusableElements()[0]?.focus();
    const handleMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isDeleting) {
          setMenuOpen(false);
          setConfirmDelete(false);
        }
      }
      if (event.key === "Tab") {
        const focusable = focusableElements();
        if (focusable.length === 0) {
          event.preventDefault();
          sheetRef.current?.focus();
          return;
        }
        if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    };
    window.addEventListener("keydown", handleMenuKeyDown);
    return () => window.removeEventListener("keydown", handleMenuKeyDown);
  }, [menuOpen, confirmDelete, isDeleting]);

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
        const scale = Math.min(
          1,
          800 / Math.max(image.width, image.height),
        );

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          setSaveError("Không thể xử lý ảnh.");
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              setSaveError("Không thể nén ảnh.");
              return;
            }

            if (blob.size > 200 * 1024) {
              setSaveError("Ảnh sau khi nén vẫn lớn hơn 200 KB.");
              return;
            }

            const compressedReader = new FileReader();

            compressedReader.onerror = () =>
              setSaveError("Không đọc được ảnh sau khi nén.");

            compressedReader.onload = () => {
              update({ image: String(compressedReader.result) });
            };

            compressedReader.readAsDataURL(blob);
          },
          "image/webp",
          0.6,
        );
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
  const deleteProduct = async () => {
    setIsDeleting(true);
    setSaveError("");
    try {
      await onDelete(product.id);
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : "Không xóa được hàng hóa.");
      setIsDeleting(false);
    }
  };

  return <div className="menu-detail-page page-enter">
    <nav className="menu-detail-nav" aria-label="Điều hướng chi tiết món">
      <button className="menu-detail-back" aria-label="Quay lại thực đơn" onClick={onBack}><Icon name="chevron" size={28} /></button>
      {!isNew && <button className="menu-detail-more" aria-label="Tùy chọn hàng hóa" aria-haspopup="dialog" onClick={() => { setMenuError(""); setMenuOpen(true); }}><Icon name="menu" size={22} /></button>}
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
    {menuOpen && createPortal(<div className="menu-detail-overlay" onClick={() => { if (!isDeleting) { setMenuOpen(false); setConfirmDelete(false); } }}>
      <section ref={sheetRef} className="menu-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="menu-detail-sheet-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <span className="menu-detail-sheet-handle" aria-hidden="true" />
        <h2 id="menu-detail-sheet-title">{confirmDelete ? "Xóa hàng hóa?" : "Xóa hàng hóa"}</h2>
        {confirmDelete
          ? <p className="menu-detail-sheet-note"><strong>{product.name}</strong> sẽ được ẩn khỏi thực đơn. Lịch sử đơn hàng và tồn kho vẫn được giữ.</p>
          : <p className="menu-detail-sheet-note">{product.name}</p>}
        {menuError && <p className="menu-detail-sheet-error" role="alert">{menuError}</p>}
        {confirmDelete ? <div className="menu-detail-sheet-actions">
          <button className="menu-detail-sheet-secondary" disabled={isDeleting} onClick={() => setConfirmDelete(false)}>Giữ lại</button>
          <button className="menu-detail-sheet-danger" disabled={isDeleting} onClick={() => void deleteProduct()}>{isDeleting ? "Đang xóa…" : "Xóa hàng hóa"}</button>
        </div> : <>
          <button className="menu-detail-sheet-option" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={20} /><span>Xóa hàng hóa</span></button>
          <button className="menu-detail-sheet-secondary menu-detail-sheet-close" onClick={() => setMenuOpen(false)}>Đóng</button>
        </>}
      </section>
    </div>, document.body)}
  </div>;
}
