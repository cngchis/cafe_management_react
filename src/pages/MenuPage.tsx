import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/Icon";
import { MenuProductDetail, type MenuItem } from "../components/MenuProductDetail";
import { formatMoney } from "../data/products";
import { createProduct, deactivateProduct, getProducts, updateProduct } from "../api/products";

export function MenuPage() {
  const [category, setCategory] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sort, setSort] = useState("price-asc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const categories = [
    "Tất cả",
    ...new Set(items.map((item) => item.category).filter(Boolean)),
  ];
  useEffect(() => {
    getProducts()
      .then((products) => setItems(products.map((product) => ({ ...product, ingredients: [] }))))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Không tải được thực đơn."))
      .finally(() => setIsLoading(false));
  }, []);

  const visibleItems = items
    .filter((item) => (category === "Tất cả" || item.category === category) && item.name.toLowerCase().includes(query.toLowerCase()))
    .sort((first, second) => sort === "name" ? first.name.localeCompare(second.name) : sort === "stock" ? first.stock - second.stock : first.price - second.price);
  const totalStock = visibleItems.reduce((sum, item) => sum + item.stock, 0);

  const saveItem = async (updated: MenuItem) => {
    setError("");
    const input = {
      sku: updated.sku,
      name: updated.name,
      category: updated.category,
      menuType: updated.menuType,
      image: updated.image,
      tag: updated.tag ?? null,
      price: updated.price,
      cost: updated.cost,
      stock: updated.stock,
    };
    const saved = isNewItem ? await createProduct(input) : await updateProduct(updated.id, input);
    const savedItem = { ...saved, ingredients: [] };
    setItems((current) => isNewItem ? [savedItem, ...current] : current.map((item) => item.id === saved.id ? savedItem : item));
    setSelectedItem(null);
    setIsNewItem(false);
  };

  const deleteItem = async (id: string) => {
    setError("");
    await deactivateProduct(id);
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedItem(null);
    setIsNewItem(false);
  };

  const addItem = () => {
    setSelectedItem({
      id: "",
      name: "",
      sku: `SP${Date.now().toString().slice(-6)}`,
      category: categories[1],
      menuType: "Món thường",
      price: 0,
      cost: 0,
      stock: 0,
      image: "",
      tag: null,
      ingredients: [],
    });
    setIsNewItem(true);
  };

  if (selectedItem) {
    return <MenuProductDetail product={selectedItem} isNew={isNewItem} onBack={() => { setSelectedItem(null); setIsNewItem(false); }} onSave={saveItem} onDelete={deleteItem} />;
  }

  return <>
    <div className="menu-page page-enter">
      <div className="catalog-sticky">
        <header className="menu-page-heading">
          <h1>Món</h1>
          <div className="menu-page-actions">
            <button className="menu-header-action" aria-label="Tìm món" onClick={() => setSearchOpen((current) => !current)}><Icon name="search" size={24} /></button>
            <button className="menu-header-action" aria-label="Đổi cách sắp xếp" onClick={() => setSort((current) => current === "price-asc" ? "name" : current === "name" ? "stock" : "price-asc")}><Icon name="sort" size={24} /></button>
            <button className="menu-header-action" aria-label="Trợ giúp" onClick={() => setHelpOpen((current) => !current)}><Icon name="help" size={23} /></button>
          </div>
        </header>
        {searchOpen && <label className="menu-search"><Icon name="search" size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm món..." /><button type="button" aria-label="Đóng tìm kiếm" onClick={() => { setSearchOpen(false); setQuery(""); }}><Icon name="close" size={17} /></button></label>}
        {helpOpen && <div className="menu-help" role="status">Chọn món để xem chi tiết, giá bán và tồn kho.</div>}
        {error && <p role="alert" className="menu-help">{error}</p>}
        <div className="menu-category-tabs" role="tablist" aria-label="Danh mục món">{categories.map((item) => <button role="tab" aria-selected={category === item} className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      </div>
      <section className="menu-list-panel">
        <div className="menu-list-toolbar"><strong>{isLoading ? "Đang tải thực đơn..." : `${visibleItems.length} món · SL tồn ${totalStock}`}</strong><label><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp món"><option value="price-asc">Giá bán</option><option value="name">Tên món</option><option value="stock">Tồn kho</option></select><Icon name="chevron" size={16} /></label></div>
        <div className="menu-product-list">
          {visibleItems.map((item) => <button className="menu-product-row" key={item.id} type="button" onClick={() => { setSelectedItem(item); setIsNewItem(false); }}>
            <img src={item.image} alt="" />
            <span className="menu-product-copy"><strong>{item.name}</strong><small>{item.sku}</small></span>
            <span className="menu-product-values"><strong>{formatMoney(item.price)}</strong><small className={item.stock < 0 ? "negative-stock" : ""}>Tồn {item.stock}</small></span>
          </button>)}
          {!isLoading && !visibleItems.length && <div className="management-empty">Không tìm thấy món phù hợp.</div>}
        </div>
      </section>
    </div>
    {createPortal(<button className="menu-add" aria-label="Thêm món" onClick={addItem}><Icon name="plus" size={26} /></button>, document.body)}
  </>;
}
