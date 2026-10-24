export type Customer = { id: string; name: string; phone: string | null; points: number; tier: string };

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể xử lý khách hàng.");
  return body as T;
}

export async function getCustomers() {
  return readResponse<{ customers: Customer[] }>(await fetch("/api/customers"));
}

export async function createCustomer(input: { name: string; phone?: string }) {
  return readResponse<{ customer: Customer }>(await fetch("/api/customers", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }));
}
