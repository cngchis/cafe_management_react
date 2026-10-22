export type InventoryCheckProduct = { id: string; sku: string; name: string; image: string | null; stock: number };
export type InventoryCheckHistory = {
  id: string;
  note: string | null;
  checkedByName: string;
  createdAt: string;
  itemCount: number;
  changedItemCount: number;
  netDelta: number;
};

export type InventoryChecksData = { products: InventoryCheckProduct[]; history: InventoryCheckHistory[] };

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể tải dữ liệu kiểm kho.");
  return body as T;
}

export async function getInventoryChecks(): Promise<InventoryChecksData> {
  return readResponse<InventoryChecksData>(await fetch("/api/inventory/checks"));
}

export async function createInventoryCheck(input: {
  note?: string;
  items: Array<{ productId: string; countedQuantity: number }>;
}): Promise<{ id: string; itemCount: number; changedItemCount: number }> {
  const body = await readResponse<{ check: { id: string; itemCount: number; changedItemCount: number } }>(await fetch("/api/inventory/checks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
  return body.check;
}
