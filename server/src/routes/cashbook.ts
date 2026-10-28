import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { cashAccounts, cashbookEntries } from "../db/schema.js";
import { getSessionAccount } from "../auth/session.js";

type EntryBody = { title: string; amountVnd: number; direction: "in" | "out" };
type BankAccountBody = { bankName: string; bankCode: string; accountNumber: string; accountHolder: string };

const canManageBankAccounts = (role: string) => role === "owner" || role === "manager";

export const cashbookRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cashbook/bank-accounts", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    const accounts = await db.select({
      id: cashAccounts.id,
      bankName: cashAccounts.bankName,
      bankCode: cashAccounts.bankCode,
      accountNumber: cashAccounts.accountNumber,
      accountHolder: cashAccounts.accountHolder,
      isDefault: cashAccounts.isDefault,
    }).from(cashAccounts).where(and(eq(cashAccounts.accountType, "bank"), eq(cashAccounts.isActive, true)))
      .orderBy(desc(cashAccounts.isDefault), desc(cashAccounts.createdAt));
    return { accounts: accounts.filter((row) => row.bankName && row.bankCode && row.accountNumber && row.accountHolder) };
  });

  app.post<{ Body: BankAccountBody }>("/cashbook/bank-accounts", {
    schema: {
      body: {
        type: "object", additionalProperties: false,
        required: ["bankName", "bankCode", "accountNumber", "accountHolder"],
        properties: {
          bankName: { type: "string", minLength: 1, maxLength: 100 },
          bankCode: { type: "string", minLength: 2, maxLength: 20 },
          accountNumber: { type: "string", minLength: 4, maxLength: 32 },
          accountHolder: { type: "string", minLength: 1, maxLength: 100 },
        },
      },
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (!canManageBankAccounts(account.role)) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền quản lý tài khoản ngân hàng." } });
    const bankName = request.body.bankName.trim();
    const bankCode = request.body.bankCode.trim().toUpperCase();
    const accountNumber = request.body.accountNumber.trim();
    const accountHolder = request.body.accountHolder.trim().toUpperCase();
    if (!bankName || !bankCode || !accountNumber || !accountHolder) {
      return reply.code(400).send({ error: { code: "INVALID_BANK_ACCOUNT", message: "Vui lòng nhập đầy đủ thông tin ngân hàng." } });
    }
    const saved = await db.transaction(async (tx) => {
      await tx.update(cashAccounts).set({ isDefault: false }).where(and(eq(cashAccounts.accountType, "bank"), eq(cashAccounts.isDefault, true)));
      const [existing] = await tx.select({ id: cashAccounts.id }).from(cashAccounts)
        .where(and(eq(cashAccounts.bankCode, bankCode), eq(cashAccounts.accountNumber, accountNumber))).limit(1);
      if (existing) {
        const [updated] = await tx.update(cashAccounts).set({
          name: `${bankName} · ${accountNumber}`, bankName, bankCode, accountNumber, accountHolder, isDefault: true, isActive: true,
        }).where(eq(cashAccounts.id, existing.id)).returning({ id: cashAccounts.id });
        return updated;
      }
      const [created] = await tx.insert(cashAccounts).values({
        name: `${bankName} · ${accountNumber}`, accountType: "bank", bankName, bankCode, accountNumber, accountHolder, isDefault: true,
      }).returning({ id: cashAccounts.id });
      return created;
    });
    const [result] = await db.select({
      id: cashAccounts.id, bankName: cashAccounts.bankName, bankCode: cashAccounts.bankCode,
      accountNumber: cashAccounts.accountNumber, accountHolder: cashAccounts.accountHolder, isDefault: cashAccounts.isDefault,
    }).from(cashAccounts).where(eq(cashAccounts.id, saved.id)).limit(1);
    return reply.code(201).send(result);
  });

  app.patch<{ Params: { id: string } }>("/cashbook/bank-accounts/:id/default", async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (!canManageBankAccounts(account.role)) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền quản lý tài khoản ngân hàng." } });
    const result = await db.transaction(async (tx) => {
      const [selected] = await tx.select({ id: cashAccounts.id }).from(cashAccounts)
        .where(and(eq(cashAccounts.id, request.params.id), eq(cashAccounts.accountType, "bank"), eq(cashAccounts.isActive, true))).limit(1);
      if (!selected) return false;
      await tx.update(cashAccounts).set({ isDefault: false }).where(and(eq(cashAccounts.accountType, "bank"), eq(cashAccounts.isDefault, true)));
      await tx.update(cashAccounts).set({ isDefault: true }).where(eq(cashAccounts.id, selected.id));
      return true;
    });
    if (!result) return reply.code(404).send({ error: { code: "BANK_ACCOUNT_NOT_FOUND", message: "Không tìm thấy tài khoản ngân hàng." } });
    return { ok: true };
  });

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
