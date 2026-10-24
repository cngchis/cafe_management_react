export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  clockInAt: string;
  clockOutAt: string | null;
  note: string | null;
};

export type HandoverSheet = {
  id: string;
  employeeId: string;
  employeeName: string;
  openedAt: string;
  closedAt: string | null;
  openingCashVnd: number;
  closingCashVnd: number | null;
  invoiceCount: number;
  revenueVnd: number;
  cashVnd: number;
  bankTransferVnd: number;
  creditVnd: number;
  items: Array<{ name: string; quantity: number; revenueVnd: number }>;
  note: string | null;
};

export type ReportData = {
  range: { from: string; to: string };
  summary: {
    invoiceCount: number; cancelledCount: number; revenueVnd: number; cancelledVnd: number;
    itemsSold: number; cogsVnd: number; grossProfitVnd: number; operatingExpenseVnd: number; netProfitVnd: number;
  };
  daily: Array<{ day: string; revenueVnd: number; cogsVnd: number; grossProfitVnd: number; cancelledVnd: number; operatingExpenseVnd: number; purchaseOutflowVnd: number; refundsVnd: number }>;
  products: Array<{ name: string; quantitySold: number; revenueVnd: number; cogsVnd: number; currentStock: number }>;
  payments: Array<{ method: string; amountVnd: number; count: number }>;
  orderTypes: Array<{ type: string; count: number; revenueVnd: number }>;
  inventory: Array<{ id: string; name: string; sku: string; stock: number }>;
};

export type ProductTarget = { id: string; name: string; category: string; price: number };
export type CustomerTarget = { id: string; name: string; phone: string | null };
export type PriceListRecord = { id: string; name: string; startsAt: string; endsAt: string | null; appliesToAllCustomers: boolean; isActive: boolean; customerCount: number; productCount: number };
export type PurchaseRecord = { id: string; receiptNumber: string; supplierName: string | null; receivedAt: string; totalVnd: number; note: string | null; itemCount: number };
export type ActivityRecord = { id: string; actorName: string; action: string; entityType: string; entityId: string | null; summary: string; occurredAt: string };

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể tải dữ liệu.");
  return body as T;
}

export async function getAttendance(from: string, to: string) {
  return readResponse<{ records: AttendanceRecord[]; current: { id: string; clockInAt: string } | null }>(
    await fetch(`/api/attendance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  );
}

export async function clockIn() {
  return readResponse<{ record: { id: string; clockInAt: string } }>(await fetch("/api/attendance/clock-in", { method: "POST" }));
}

export async function clockOut() {
  return readResponse<{ record: { id: string; clockInAt: string; clockOutAt: string } }>(await fetch("/api/attendance/clock-out", { method: "POST" }));
}

export async function getHandovers() {
  return readResponse<{ handovers: HandoverSheet[]; current: HandoverSheet | null }>(await fetch("/api/shift-handovers"));
}

export async function openHandover(openingCashVnd: number, note?: string) {
  return readResponse<{ handover: { id: string; openedAt: string } }>(await fetch("/api/shift-handovers", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ openingCashVnd, note }),
  }));
}

export async function closeHandover(id: string, closingCashVnd: number, note?: string) {
  return readResponse<{ handover: Partial<HandoverSheet> }>(await fetch(`/api/shift-handovers/${id}/close`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ closingCashVnd, note }),
  }));
}

export async function getReports(from: string, to: string) {
  return readResponse<ReportData>(await fetch(`/api/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`));
}

export async function getPriceListTargets() {
  return readResponse<{ products: ProductTarget[]; customers: CustomerTarget[] }>(await fetch("/api/price-lists/targets"));
}

export async function getPriceLists() {
  return readResponse<{ lists: PriceListRecord[] }>(await fetch("/api/price-lists"));
}

export async function createPriceList(input: { name: string; startsAt: string; endsAt?: string; appliesToAllCustomers: boolean; customerIds: string[]; items: Array<{ productId: string; salePriceVnd: number }> }) {
  return readResponse<{ list: { id: string; name: string } }>(await fetch("/api/price-lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
}

export async function deactivatePriceList(id: string) {
  return readResponse(await fetch(`/api/price-lists/${id}/deactivate`, { method: "POST" }));
}

export async function getPurchases() {
  return readResponse<{ receipts: PurchaseRecord[] }>(await fetch("/api/purchases"));
}

export async function createPurchase(input: { supplierName?: string; note?: string; items: Array<{ productId: string; quantity: number; unitCostVnd: number }> }) {
  return readResponse<{ receipt: PurchaseRecord }>(await fetch("/api/purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
}

export async function getActivity() {
  return readResponse<{ events: ActivityRecord[] }>(await fetch("/api/activity"));
}
