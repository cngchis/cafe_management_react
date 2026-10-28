import Fastify, { type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { and, eq, sql } from "drizzle-orm";
import { verify } from "argon2";
import { db } from "./db/index.js";
import { pool } from "./db/index.js";
import { accounts, inventoryMovements, products, type Account } from "./db/schema.js";
import { config } from "./config.js";
import { productRoutes } from "./routes/products.js";
import { orderRoutes } from "./routes/orders.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { cashbookRoutes } from "./routes/cashbook.js";
import { inventoryCheckRoutes } from "./routes/inventory-checks.js";
import { employeeRoutes } from "./routes/employees.js";
import { workforceRoutes } from "./routes/workforce.js";
import { dataResetRoutes } from "./routes/data-reset.js";
import { attendanceRoutes } from "./routes/attendance.js";
import { shiftHandoverRoutes } from "./routes/shift-handovers.js";
import { reportRoutes } from "./routes/reports.js";
import { purchaseRoutes } from "./routes/purchases.js";
import { priceListRoutes } from "./routes/price-lists.js";
import { activityRoutes } from "./routes/activity.js";
import { customerRoutes } from "./routes/customers.js";
import { serviceTableRoutes } from "./routes/service-tables.js";
import { getSessionAccount } from "./auth/session.js";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const sessionCookie = "coic_session";
const sessionDurationSeconds = 60 * 60 * 8;

function publicAccount(account: Account) {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
  };
}

export async function createApp() {
  const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    const code = error.validation ? "VALIDATION_ERROR" : (error as FastifyError & { code?: string }).code ?? (statusCode === 429 ? "RATE_LIMITED" : "INTERNAL_ERROR");
    const message = statusCode === 500 ? "Đã xảy ra lỗi máy chủ." : error.message;
    if (statusCode === 500) app.log.error(error);
    return reply.code(statusCode).send({ error: { code, message } });
  });

  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: sessionCookie, signed: false },
  });
  await app.register(rateLimit, { global: false });

  app.get("/api/health", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok", database: "connected" };
    } catch {
      return reply.code(503).send({ status: "unavailable", database: "disconnected" });
    }
  });

  app.post<{ Body: { username: string; password: string; destination: "/" | "/pos" } }>(
    "/api/auth/login",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["username", "password", "destination"],
          properties: {
            username: { type: "string", minLength: 1, maxLength: 100 },
            password: { type: "string", minLength: 1, maxLength: 1024 },
            destination: { type: "string", enum: ["/", "/pos"] },
          },
        },
      },
    },
    async (request, reply) => {
      const [account] = await db
        .select()
        .from(accounts)
        .where(and(sql`lower(${accounts.username}) = lower(${request.body.username.trim()})`, eq(accounts.isActive, true)))
        .limit(1);

      if (!account || !(await verify(account.passwordHash, request.body.password))) {
        return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không đúng." } });
      }

      const token = app.jwt.sign({ sub: account.id }, { expiresIn: sessionDurationSeconds });
      reply.setCookie(sessionCookie, token, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: sessionDurationSeconds,
      });

      return { account: publicAccount(account), destination: request.body.destination };
    },
  );

  app.get("/api/auth/me", async (request, reply) => {
    let accountId: string;
    try {
      await request.jwtVerify();
      const subject = (request.user as { sub?: string }).sub;
      if (!subject) throw new Error("Missing account id");
      accountId = subject;
    } catch {
      reply.clearCookie(sessionCookie, { path: "/" });
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    }

    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.isActive, true)))
      .limit(1);

    if (!account) {
      reply.clearCookie(sessionCookie, { path: "/" });
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    }

    return { account: publicAccount(account) };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie(sessionCookie, { path: "/" });
    return reply.code(204).send();
  });

  await app.register(productRoutes, { prefix: "/api" });
  await app.register(orderRoutes, { prefix: "/api" });
  await app.register(dashboardRoutes, { prefix: "/api" });
  await app.register(cashbookRoutes, { prefix: "/api" });
  await app.register(inventoryCheckRoutes, { prefix: "/api" });
  await app.register(employeeRoutes, { prefix: "/api" });
  await app.register(workforceRoutes, { prefix: "/api" });
  await app.register(dataResetRoutes, { prefix: "/api" });
  await app.register(attendanceRoutes, { prefix: "/api" });
  await app.register(shiftHandoverRoutes, { prefix: "/api" });
  await app.register(reportRoutes, { prefix: "/api" });
  await app.register(purchaseRoutes, { prefix: "/api" });
  await app.register(priceListRoutes, { prefix: "/api" });
  await app.register(activityRoutes, { prefix: "/api" });
  await app.register(customerRoutes, { prefix: "/api" });
  await app.register(serviceTableRoutes, { prefix: "/api" });

  const staticRoot = resolve(process.cwd(), "dist");
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".otf": "font/otf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  app.get("/*", async (request, reply) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found." } });
    }

    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      return reply.code(400).send({ error: { code: "INVALID_PATH", message: "Invalid path." } });
    }

    const filePath = resolve(staticRoot, `.${decodedPath}`);
    if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${sep}`)) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found." } });
    }

    try {
      const file = await readFile(filePath);
      return reply.type(contentTypes[extname(filePath)] ?? "application/octet-stream").send(file);
    } catch {
      if (extname(decodedPath)) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found." } });
      const index = await readFile(join(staticRoot, "index.html"));
      return reply.type("text/html; charset=utf-8").send(index);
    }
  });

  return app;
}
