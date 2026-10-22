import { and, eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { accounts } from "../db/schema.js";

export async function getSessionAccount(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch {
    return null;
  }

  const accountId = (request.user as { sub?: string }).sub;
  if (!accountId) return null;

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.isActive, true)))
    .limit(1);

  return account ?? null;
}
