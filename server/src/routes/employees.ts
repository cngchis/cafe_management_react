import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { hash } from "argon2";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { accounts } from "../db/schema.js";

type EmployeeRole = "manager" | "cashier";
type CreateEmployeeBody = { username: string; password: string; displayName: string; role: EmployeeRole; hourlyRateVnd: number };
type UpdateEmployeeBody = Partial<Pick<CreateEmployeeBody, "displayName" | "role" | "hourlyRateVnd"> & { isActive: boolean }>;

async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  const account = await getSessionAccount(request);
  if (!account) {
    reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    return null;
  }
  if (account.role !== "owner") {
    reply.code(403).send({ error: { code: "FORBIDDEN", message: "Chỉ chủ cửa hàng được quản lý nhân viên." } });
    return null;
  }
  return account;
}

export const employeeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/employees", async (request, reply) => {
    if (!(await requireOwner(request, reply))) return;
    const employees = await db.select({
      id: accounts.id,
      username: accounts.username,
      displayName: accounts.displayName,
      role: accounts.role,
      hourlyRateVnd: accounts.hourlyRateVnd,
      isActive: accounts.isActive,
      createdAt: accounts.createdAt,
    }).from(accounts).where(inArray(accounts.role, ["manager", "cashier"]))
      .orderBy(desc(accounts.isActive), accounts.displayName);
    return { employees };
  });

  app.post<{ Body: CreateEmployeeBody }>("/employees", {
    schema: { body: {
      type: "object", additionalProperties: false,
      required: ["username", "password", "displayName", "role", "hourlyRateVnd"],
      properties: {
        username: { type: "string", minLength: 1, maxLength: 100 },
        password: { type: "string", minLength: 8, maxLength: 1024 },
        displayName: { type: "string", minLength: 1, maxLength: 200 },
        role: { type: "string", enum: ["manager", "cashier"] },
        hourlyRateVnd: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
      },
    } },
  }, async (request, reply) => {
    if (!(await requireOwner(request, reply))) return;
    const username = request.body.username.trim();
    const displayName = request.body.displayName.trim();
    if (!username || !displayName) return reply.code(422).send({ error: { code: "INVALID_EMPLOYEE", message: "Tên đăng nhập và tên nhân viên không được để trống." } });
    try {
      const [employee] = await db.insert(accounts).values({
        username, passwordHash: await hash(request.body.password), displayName,
        role: request.body.role, hourlyRateVnd: request.body.hourlyRateVnd,
      }).returning({ id: accounts.id, username: accounts.username, displayName: accounts.displayName, role: accounts.role, hourlyRateVnd: accounts.hourlyRateVnd, isActive: accounts.isActive });
      return reply.code(201).send({ employee });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: { code: "USERNAME_CONFLICT", message: "Tên đăng nhập đã được sử dụng." } });
      throw error;
    }
  });

  app.patch<{ Params: { id: string }; Body: UpdateEmployeeBody }>("/employees/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object", additionalProperties: false, minProperties: 1,
        properties: {
          displayName: { type: "string", minLength: 1, maxLength: 200 },
          role: { type: "string", enum: ["manager", "cashier"] },
          hourlyRateVnd: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    if (!(await requireOwner(request, reply))) return;
    const changes = request.body;
    if (changes.displayName !== undefined && !changes.displayName.trim()) return reply.code(422).send({ error: { code: "INVALID_EMPLOYEE", message: "Tên nhân viên không được để trống." } });
    const [employee] = await db.update(accounts).set({
      ...(changes.displayName !== undefined && { displayName: changes.displayName.trim() }),
      ...(changes.role !== undefined && { role: changes.role }),
      ...(changes.hourlyRateVnd !== undefined && { hourlyRateVnd: changes.hourlyRateVnd }),
      ...(changes.isActive !== undefined && { isActive: changes.isActive }),
      updatedAt: new Date(),
    }).where(and(eq(accounts.id, request.params.id), inArray(accounts.role, ["manager", "cashier"])))
      .returning({ id: accounts.id, username: accounts.username, displayName: accounts.displayName, role: accounts.role, hourlyRateVnd: accounts.hourlyRateVnd, isActive: accounts.isActive });
    if (!employee) return reply.code(404).send({ error: { code: "EMPLOYEE_NOT_FOUND", message: "Không tìm thấy nhân viên." } });
    return { employee };
  });
};
