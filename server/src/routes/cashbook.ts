import type { FastifyPluginAsync } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { cashAccounts, cashbookEntries } from "../db/schema.js";
import { getSessionAccount } from "../auth/session.js";

type EntryBody = { title: string; amountVnd: number; direction: "in" | "out" };

export const cashbookRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { account?: "cash" | "bank" | "all" } }>("/cashbook", async (request, reply) => {
    const sessionAccount = await getSessionAccount(request);
    if (!sessionAccount) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (sessionAccount.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền xem sổ quỹ." } });

    const accountType = request.query.account === "cash" || request.query.account === "bank" ? request.query.account : undefined;
    const accountFilter = accountType ? eq(cashAccounts.accountType, accountType) : undefined;
    const [totals] = await db.select({
      incomeVnd: sql<number>`coalesce(sum(case when ${cashbookEntries.direction} = 'in' then ${cashbookEntries.amountVnd} else 0 end), 0)`.mapWith(Number),
      expenseVnd: sql<number>`coalesce(sum(case when ${cashbookEntries.direction} = 'out' then ${cashbookEntries.amountVnd} else 0 end), 0)`.mapWith(Number),
    }).from(cashbookEntries).innerJoin(cashAccounts, eq(cashAccounts.id, cashbookEntries.cashAccountId))
      .where(accountFilter);
    const entries = await db.select({
      id: cashbookEntries.id,
      title: cashbookEntries.title,
      reference: cashbookEntries.referenceCode,
      direction: cashbookEntries.direction,
      category: cashbookEntries.category,
      partyGroup: cashbookEntries.counterpartyGroup,
      partyName: cashbookEntries.counterpartyName,
      description: cashbookEntries.description,
      amountVnd: cashbookEntries.amountVnd,
      cashier: cashbookEntries.createdByName,
      occurredAt: cashbookEntries.occurredAt,
      account: cashAccounts.name,
      accountType: cashAccounts.accountType,
    }).from(cashbookEntries).innerJoin(cashAccounts, eq(cashAccounts.id, cashbookEntries.cashAccountId))
      .where(accountFilter)
      .orderBy(desc(cashbookEntries.occurredAt)).limit(200);

    return { entries, totals: { openingVnd: 0, ...totals } };
  });

  app.post<{ Body: EntryBody }>("/cashbook", {
    schema: {
      body: {
        type: "object", additionalProperties: false, required: ["title", "amountVnd", "direction"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          amountVnd: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
          direction: { type: "string", enum: ["in", "out"] },
        },
      },
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền ghi sổ quỹ." } });
    const title = request.body.title.trim();
    if (!title) return reply.code(400).send({ error: { code: "INVALID_TITLE", message: "Nội dung phiếu không được để trống." } });

    const entry = await db.transaction(async (tx) => {
      await tx.insert(cashAccounts).values({ name: "Tiền mặt", accountType: "cash" }).onConflictDoNothing();
      const [cashAccount] = await tx.select({ id: cashAccounts.id }).from(cashAccounts)
        .where(eq(cashAccounts.name, "Tiền mặt")).limit(1);
      const prefix = request.body.direction === "in" ? "PT" : "PC";
      const [created] = await tx.insert(cashbookEntries).values({
        cashAccountId: cashAccount.id,
        referenceCode: `${prefix}${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        direction: request.body.direction,
        title,
        category: request.body.direction === "in" ? "Thu khác" : "Chi khác",
        counterpartyGroup: request.body.direction === "in" ? "Khác" : "Nhà cung cấp",
        counterpartyName: request.body.direction === "in" ? "Khác" : "Nhà cung cấp",
        description: title,
        amountVnd: request.body.amountVnd,
        createdByName: account.displayName,
      }).returning({ id: cashbookEntries.id });
      return created;
    });

    return reply.code(201).send({ id: entry.id });
  });
};
