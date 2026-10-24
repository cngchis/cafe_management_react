export type CreateOrderInput = {
  items: Array<{ productId: string; quantity: number }>;
  orderType: "dine_in" | "takeaway" | "delivery";
  note?: string;
};

export type CreatedOrder = { id: string; orderNumber: string; totalVnd: number };

export type OrderRecord = {
  id: string;
  receiptCode: string;
  orderNumber: string;
  orderType: "dine_in" | "takeaway" | "delivery" | "staff";
  serviceLocation: string | null;
  guestCount: number;
  cashierName: string | null;
  subtotalVnd: number;
  discountVnd: number;
  serviceFeeVnd: number;
  totalVnd: number;
  status: string;
  orderedAt: string;
  paymentMethod: string | null;
  paidAmountVnd: number;
};

export type OrderDetailRecord = OrderRecord & {
  items: Array<{
    name: string;
    portion: string | null;
    note: string | null;
    quantity: number;
    unitPriceVnd: number;
    lineTotalVnd: number;
  }>;
};

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể tải hóa đơn.");
  return body as T;
}

export async function createOrder(input: CreateOrderInput, idempotencyKey: string): Promise<CreatedOrder> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể hoàn tất thanh toán. Vui lòng thử lại.");
  return body.order as CreatedOrder;
}

export async function getOrders(): Promise<OrderRecord[]> {
  const response = await fetch("/api/orders");
  return (await readResponse<{ orders: OrderRecord[] }>(response)).orders;
}

export async function getOrder(id: string): Promise<OrderDetailRecord> {
  const response = await fetch(`/api/orders/${id}`);
  return (await readResponse<{ order: OrderDetailRecord }>(response)).order;
}

export async function cancelOrder(id: string): Promise<void> {
  const response = await fetch(`/api/orders/${id}/cancel`, { method: "POST" });
  if (!response.ok) await readResponse<void>(response);
}
