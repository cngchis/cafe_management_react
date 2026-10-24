import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { from: string; to: string } }>("/reports", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const { from, to } = request.query;
    if (!datePattern.test(from) || !datePattern.test(to) || from > to || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 366) {
      return reply.code(400).send({ error: { code: "INVALID_REPORT_RANGE", message: "Khoảng ngày báo cáo không hợp lệ (tối đa 367 ngày)." } });
    }

    const bounds = `WITH bounds AS (
      SELECT ($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS starts_at,
        (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS ends_at
    )`;
    const [summaryResult, dailyResult, productsResult, paymentsResult, orderTypesResult, inventoryResult] = await Promise.all([
      pool.query(`${bounds}, order_totals AS (
          SELECT o.id, o.status, o.total_vnd, o.ordered_at FROM orders o CROSS JOIN bounds b
          WHERE o.ordered_at >= b.starts_at AND o.ordered_at < b.ends_at
        ), item_totals AS (
          SELECT coalesce(sum(oi.quantity), 0)::bigint AS items_sold,
            coalesce(sum(oi.quantity::numeric * oi.unit_cost_vnd), 0)::bigint AS cogs_vnd
          FROM order_totals o JOIN order_items oi ON oi.order_id = o.id WHERE o.status = 'completed'
        ), sales_totals AS (
          SELECT count(*) FILTER (WHERE status = 'completed')::int AS invoice_count,
            count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_count,
            coalesce(sum(total_vnd) FILTER (WHERE status = 'completed'), 0)::bigint AS revenue_vnd,
            coalesce(sum(total_vnd) FILTER (WHERE status = 'cancelled'), 0)::bigint AS cancelled_vnd
          FROM order_totals
        ) SELECT * FROM sales_totals CROSS JOIN item_totals`, [from, to]),
      pool.query(`${bounds}, days AS (
          SELECT generate_series(b.starts_at, b.ends_at - interval '1 day', interval '1 day') AS day FROM bounds b
        ), order_daily AS (
          SELECT (((o.ordered_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
            coalesce(sum(o.total_vnd) FILTER (WHERE o.status = 'completed'), 0)::bigint AS revenue_vnd,
            coalesce(sum(o.total_vnd) FILTER (WHERE o.status = 'cancelled'), 0)::bigint AS cancelled_vnd
          FROM orders o CROSS JOIN bounds b WHERE o.ordered_at >= b.starts_at AND o.ordered_at < b.ends_at GROUP BY 1
        ), cost_daily AS (
          SELECT (((o.ordered_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
            coalesce(sum(oi.quantity::numeric * oi.unit_cost_vnd), 0)::bigint AS cogs_vnd
          FROM orders o JOIN order_items oi ON oi.order_id = o.id CROSS JOIN bounds b
          WHERE o.status = 'completed' AND o.ordered_at >= b.starts_at AND o.ordered_at < b.ends_at GROUP BY 1
        ), expense_daily AS (
          SELECT (((cb.occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
            coalesce(sum(cb.amount_vnd) FILTER (WHERE cb.category NOT ILIKE 'Hoàn tiền%' AND cb.category <> 'Nhập hàng'), 0)::bigint AS operating_expense_vnd,
            coalesce(sum(cb.amount_vnd) FILTER (WHERE cb.category = 'Nhập hàng'), 0)::bigint AS purchase_outflow_vnd,
            coalesce(sum(cb.amount_vnd) FILTER (WHERE cb.category ILIKE 'Hoàn tiền%'), 0)::bigint AS refunds_vnd
          FROM cashbook_entries cb CROSS JOIN bounds b WHERE cb.direction = 'out'
            AND cb.occurred_at >= b.starts_at AND cb.occurred_at < b.ends_at GROUP BY 1
        ) SELECT to_char(d.day AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day,
          coalesce(o.revenue_vnd, 0)::bigint AS revenue_vnd, coalesce(c.cogs_vnd, 0)::bigint AS cogs_vnd,
          coalesce(o.cancelled_vnd, 0)::bigint AS cancelled_vnd,
          coalesce(e.operating_expense_vnd, 0)::bigint AS operating_expense_vnd,
          coalesce(e.purchase_outflow_vnd, 0)::bigint AS purchase_outflow_vnd,
          coalesce(e.refunds_vnd, 0)::bigint AS refunds_vnd
        FROM days d LEFT JOIN order_daily o USING(day) LEFT JOIN cost_daily c USING(day) LEFT JOIN expense_daily e USING(day)
        ORDER BY d.day`, [from, to]),
      pool.query(`${bounds}, stock AS (
          SELECT product_id, coalesce(sum(quantity_delta), 0)::numeric AS current_stock
          FROM inventory_movements GROUP BY product_id
        ) SELECT oi.product_name_snapshot AS name, coalesce(sum(oi.quantity), 0)::bigint AS quantity_sold,
          coalesce(sum(oi.line_total_vnd), 0)::bigint AS revenue_vnd,
          coalesce(sum(oi.quantity::numeric * oi.unit_cost_vnd), 0)::bigint AS cogs_vnd,
          coalesce(max(stock.current_stock), 0)::numeric AS current_stock
        FROM orders o JOIN order_items oi ON oi.order_id = o.id CROSS JOIN bounds b
        LEFT JOIN products p ON p.id = oi.product_id LEFT JOIN stock ON stock.product_id = p.id
        WHERE o.status = 'completed' AND o.ordered_at >= b.starts_at AND o.ordered_at < b.ends_at
        GROUP BY oi.product_name_snapshot ORDER BY revenue_vnd DESC LIMIT 100`, [from, to]),
      pool.query(`${bounds}
        SELECT p.method, coalesce(sum(p.amount_vnd), 0)::bigint AS amount_vnd,
          count(*)::int AS payment_count
        FROM payments p JOIN orders o ON o.id = p.order_id CROSS JOIN bounds b
        WHERE o.ordered_at >= b.starts_at AND o.ordered_at < b.ends_at AND o.status = 'completed'
          AND (p.status = 'completed' OR (p.method = 'credit' AND p.status = 'pending'))
        GROUP BY p.method ORDER BY amount_vnd DESC`, [from, to]),
      pool.query(`${bounds}
        SELECT o.order_type, count(*)::int AS order_count, coalesce(sum(o.total_vnd), 0)::bigint AS revenue_vnd
        FROM orders o CROSS JOIN bounds b WHERE o.status = 'completed'
          AND o.ordered_at >= b.starts_at AND o.ordered_at < b.ends_at
        GROUP BY o.order_type ORDER BY revenue_vnd DESC`, [from, to]),
      pool.query(`SELECT p.id, p.name, p.sku, coalesce(sum(im.quantity_delta), 0)::numeric AS stock
        FROM products p LEFT JOIN inventory_movements im ON im.product_id = p.id
        WHERE p.is_active GROUP BY p.id ORDER BY p.name LIMIT 100`),
    ]);

    const summary = summaryResult.rows[0];
    const revenueVnd = Number(summary.revenue_vnd);
    const cogsVnd = Number(summary.cogs_vnd);
    const daily = dailyResult.rows.map((row) => ({
      day: row.day,
      revenueVnd: Number(row.revenue_vnd),
      cogsVnd: Number(row.cogs_vnd),
      grossProfitVnd: Number(row.revenue_vnd) - Number(row.cogs_vnd),
      cancelledVnd: Number(row.cancelled_vnd),
      operatingExpenseVnd: Number(row.operating_expense_vnd),
      purchaseOutflowVnd: Number(row.purchase_outflow_vnd),
      refundsVnd: Number(row.refunds_vnd),
    }));
    const totalOperatingExpenseVnd = daily.reduce((sum, row) => sum + row.operatingExpenseVnd, 0);
    return {
      range: { from, to },
      summary: {
        invoiceCount: Number(summary.invoice_count), cancelledCount: Number(summary.cancelled_count),
        revenueVnd, cancelledVnd: Number(summary.cancelled_vnd), itemsSold: Number(summary.items_sold), cogsVnd,
        grossProfitVnd: revenueVnd - cogsVnd, operatingExpenseVnd: totalOperatingExpenseVnd,
        netProfitVnd: revenueVnd - cogsVnd - totalOperatingExpenseVnd,
      },
      daily,
      products: productsResult.rows.map((row) => ({
        name: row.name, quantitySold: Number(row.quantity_sold), revenueVnd: Number(row.revenue_vnd),
        cogsVnd: Number(row.cogs_vnd), currentStock: Number(row.current_stock ?? 0),
      })),
      payments: paymentsResult.rows.map((row) => ({ method: row.method, amountVnd: Number(row.amount_vnd), count: Number(row.payment_count) })),
      orderTypes: orderTypesResult.rows.map((row) => ({ type: row.order_type, count: Number(row.order_count), revenueVnd: Number(row.revenue_vnd) })),
      inventory: inventoryResult.rows.map((row) => ({ id: row.id, name: row.name, sku: row.sku, stock: Number(row.stock) })),
    };
  });
};
