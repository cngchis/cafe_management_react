export type DashboardSummary = {
  today: { revenueVnd: number; orderCount: number; averageOrderVnd: number; itemCount: number };
  yesterday: { revenueVnd: number; orderCount: number; averageOrderVnd: number; itemCount: number };
  weeklyRevenue: Array<{ day: string; revenueVnd: number }>;
  bestSellers: Array<{ productId: string | null; name: string; imageUrl: string | null; quantitySold: number; revenueVnd: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    orderType: string;
    serviceLocation: string | null;
    totalVnd: number;
    itemCount: number;
    status: string;
    orderedAt: string;
  }>;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch("/api/dashboard/summary");
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không tải được dữ liệu tổng quan.");
  return body.summary as DashboardSummary;
}
