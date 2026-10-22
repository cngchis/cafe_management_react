export const formatMoney = (value: number) => `${value.toLocaleString("vi-VN")}đ`;

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  menuType: string;
  price: number;
  cost: number;
  stock: number;
  image: string;
  tag?: string | null;
};
