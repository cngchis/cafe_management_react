import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dashboard/summary", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    }
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền xem tổng quan." } });

    const { rows: [totals] } = await pool.query<{
      today_revenue_vnd: string;
      today_order_count: string;
      today_average_order_vnd: string;
      today_item_count: string;
      yesterday_revenue_vnd: string;
      yesterday_order_count: string;
      yesterday_average_order_vnd: string;
      yesterday_item_count: string;
    }>(`
      WITH bounds AS (
        SELECT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS today_start
      ), period_orders AS (
        SELECT o.id, o.total_vnd, o.ordered_at
        FROM orders o CROSS JOIN bounds b
        WHERE o.status = 'completed'
          AND o.ordered_at >= b.today_start - interval '1 day'
          AND o.ordered_at < b.today_start + interval '1 day'
      ), item_totals AS (
        SELECT order_id, sum(quantity)::bigint AS item_count
        FROM order_items GROUP BY order_id
      )
      SELECT
        COALESCE(sum(o.total_vnd) FILTER (WHERE o.ordered_at >= b.today_start), 0)::bigint AS today_revenue_vnd,
        count(o.id) FILTER (WHERE o.ordered_at >= b.today_start) AS today_order_count,
        COALESCE(round(avg(o.total_vnd) FILTER (WHERE o.ordered_at >= b.today_start)), 0)::bigint AS today_average_order_vnd,
        COALESCE(sum(items.item_count) FILTER (WHERE o.ordered_at >= b.today_start), 0)::bigint AS today_item_count,
        COALESCE(sum(o.total_vnd) FILTER (WHERE o.ordered_at >= b.today_start - interval '1 day' AND o.ordered_at < b.today_start), 0)::bigint AS yesterday_revenue_vnd,
        count(o.id) FILTER (WHERE o.ordered_at >= b.today_start - interval '1 day' AND o.ordered_at < b.today_start) AS yesterday_order_count,
        COALESCE(round(avg(o.total_vnd) FILTER (WHERE o.ordered_at >= b.today_start - interval '1 day' AND o.ordered_at < b.today_start)), 0)::bigint AS yesterday_average_order_vnd,
        COALESCE(sum(items.item_count) FILTER (WHERE o.ordered_at >= b.today_start - interval '1 day' AND o.ordered_at < b.today_start), 0)::bigint AS yesterday_item_count
      FROM period_orders o
      CROSS JOIN bounds b
      LEFT JOIN item_totals items ON items.order_id = o.id
    `);

    const { rows: weeklyRevenue } = await pool.query<{ day: string; revenue_vnd: string }>(`
      WITH bounds AS (
        SELECT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS today_start
      ), days AS (
        SELECT generate_series(
          (today_start AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 6,
          (today_start AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
          interval '1 day'
        )::date AS day
        FROM bounds
      ), daily AS (
        SELECT (o.ordered_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, sum(o.total_vnd)::bigint AS revenue_vnd
        FROM orders o CROSS JOIN bounds b
        WHERE o.status = 'completed'
          AND o.ordered_at >= b.today_start - interval '6 days'
          AND o.ordered_at < b.today_start + interval '1 day'
        GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS day, COALESCE(daily.revenue_vnd, 0)::bigint AS revenue_vnd
      FROM days LEFT JOIN daily USING (day)
      ORDER BY days.day
    `);

    const { rows: bestSellers } = await pool.query<{
      product_id: string | null;
      name: string;
      image_url: string | null;
      quantity_sold: string;
      revenue_vnd: string;
    }>(`
      WITH bounds AS (
        SELECT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS today_start
      )
      SELECT oi.product_id, oi.product_name_snapshot AS name, p.image_url,
        sum(oi.quantity)::bigint AS quantity_sold, sum(oi.line_total_vnd)::bigint AS revenue_vnd
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      CROSS JOIN bounds b
      WHERE o.status = 'completed'
        AND o.ordered_at >= b.today_start
        AND o.ordered_at < b.today_start + interval '1 day'
      GROUP BY oi.product_id, oi.product_name_snapshot, p.image_url
      ORDER BY quantity_sold DESC, revenue_vnd DESC
      LIMIT 4
    `);

    const { rows: recentOrders } = await pool.query<{
      id: string;
      order_number: string;
      order_type: string;
      service_location: string | null;
      total_vnd: string;
      item_count: string;
      status: string;
      ordered_at: Date;
    }>(`
      SELECT o.id, o.order_number, o.order_type, o.service_location, o.total_vnd,
        COALESCE(sum(oi.quantity), 0)::bigint AS item_count, o.status, o.ordered_at
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status = 'completed'
      GROUP BY o.id
      ORDER BY o.ordered_at DESC
      LIMIT 5
    `);

    const asNumber = (value: string) => Number(value);
    return {
      summary: {
        today: {
          revenueVnd: asNumber(totals.today_revenue_vnd),
          orderCount: asNumber(totals.today_order_count),
          averageOrderVnd: asNumber(totals.today_average_order_vnd),
          itemCount: asNumber(totals.today_item_count),
        },
        yesterday: {
          revenueVnd: asNumber(totals.yesterday_revenue_vnd),
          orderCount: asNumber(totals.yesterday_order_count),
          averageOrderVnd: asNumber(totals.yesterday_average_order_vnd),
          itemCount: asNumber(totals.yesterday_item_count),
        },
        weeklyRevenue: weeklyRevenue.map((row) => ({ day: row.day, revenueVnd: asNumber(row.revenue_vnd) })),
        bestSellers: bestSellers.map((row) => ({
          productId: row.product_id,
          name: row.name,
          imageUrl: row.image_url,
          quantitySold: asNumber(row.quantity_sold),
          revenueVnd: asNumber(row.revenue_vnd),
        })),
        recentOrders: recentOrders.map((row) => ({
          id: row.id,
          orderNumber: row.order_number,
          orderType: row.order_type,
          serviceLocation: row.service_location,
          totalVnd: asNumber(row.total_vnd),
          itemCount: asNumber(row.item_count),
          status: row.status,
          orderedAt: row.ordered_at,
        })),
      },
    };
  });
};
