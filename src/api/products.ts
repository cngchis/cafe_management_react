import type { Product } from "../data/products";

export type ProductInput = Omit<Product, "id">;

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Không thể lưu món. Vui lòng thử lại.");
  }
  return body as T;
}

export async function getProducts(): Promise<Product[]> {
  const response = await fetch("/api/products");
  return (await readResponse<{ products: Product[] }>(response)).products;
}

export async function createProduct(product: ProductInput): Promise<Product> {
  const response = await fetch("/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(product),
  });
  return (await readResponse<{ product: Product }>(response)).product;
}

export async function updateProduct(id: string, product: ProductInput): Promise<Product> {
  const response = await fetch(`/api/products/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(product),
  });
  return (await readResponse<{ product: Product }>(response)).product;
}

export async function deactivateProduct(id: string): Promise<void> {
  const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
  if (!response.ok) await readResponse<void>(response);
}
