import type { FastifyPluginAsync } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { getSessionAccount } from "../auth/session.js";
import { inventoryMovements, products } from "../db/schema.js";

const productProperties = {
  sku: { type: "string", minLength: 1, maxLength: 100 },
  name: { type: "string", minLength: 1, maxLength: 255 },
  category: { type: "string", minLength: 1, maxLength: 100 },
  menuType: { type: "string", maxLength: 100 },
  image: { type: "string", maxLength: 1800000 },
  tag: { type: ["string", "null"], maxLength: 100 },
  price: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
  cost: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
  stock: { type: "number", minimum: 0, maximum: 1000000000, multipleOf: 0.001 },
};

const productSchema = {
  type: "object",
  additionalProperties: false,
  properties: productProperties,
};

const productPatchSchema = {
  ...productSchema,
  minProperties: 1,
  properties: { ...productProperties, stock: { ...productProperties.stock, minimum: -1000000000 } },
};

function publicProduct(product: {
  id: string;
  sku: string;
  name: string;
  category: string;
  menuType: string;
  imageUrl: string | null;
  tag: string | null;
  price: number;
  cost: number;
  stock: number;
}) {
  return { ...product, image: product.imageUrl ?? "" };
}

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.get("/products", async (request, reply) => {
    if (!(await getSessionAccount(request))) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    }

    const rows = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        category: products.category,
        menuType: products.menuType,
        imageUrl: products.imageUrl,
        tag: products.tag,
        price: products.salePriceVnd,
        cost: products.costPriceVnd,
        stock: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`.mapWith(Number),
      })
      .from(products)
      .leftJoin(inventoryMovements, eq(inventoryMovements.productId, products.id))
      .where(eq(products.isActive, true))
      .groupBy(products.id)
      .orderBy(products.name);

    return { products: rows.map(publicProduct) };
  });

  app.post<{
    Body: {
      sku: string;
      name: string;
      category: string;
      menuType?: string;
      image?: string;
      tag?: string | null;
      price: number;
      cost: number;
      stock?: number;
    };
  }>("/products", {
    schema: {
      body: {
        ...productSchema,
        required: ["sku", "name", "category", "price", "cost"],
      },
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền sửa thực đơn." } });
    if (![request.body.sku, request.body.name, request.body.category].every((value) => value.trim())) {
      return reply.code(422).send({ error: { code: "VALIDATION_ERROR", message: "Mã món, tên và danh mục không được để trống." } });
    }

    try {
      const product = await db.transaction(async (tx) => {
        const [created] = await tx.insert(products).values({
          sku: request.body.sku.trim(),
          name: request.body.name.trim(),
          category: request.body.category.trim(),
          menuType: request.body.menuType?.trim() || "Món thường",
          imageUrl: request.body.image || null,
          tag: request.body.tag || null,
          salePriceVnd: request.body.price,
          costPriceVnd: request.body.cost,
        }).returning();

        if (request.body.stock) {
          await tx.insert(inventoryMovements).values({
            productId: created.id,
            quantityDelta: request.body.stock,
            reason: "opening_balance",
            note: "Tồn đầu kỳ",
            createdByName: account.displayName,
          });
        }

        return created;
      });
      return reply.code(201).send({ product: publicProduct({ ...product, price: product.salePriceVnd, cost: product.costPriceVnd, stock: request.body.stock ?? 0 }) });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: { code: "SKU_CONFLICT", message: "Mã SKU đã tồn tại." } });
      }
      throw error;
    }
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<{
      sku: string;
      name: string;
      category: string;
      menuType: string;
      image: string;
      tag: string | null;
      price: number;
      cost: number;
      stock: number;
    }>;
  }>("/products/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: productPatchSchema,
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền sửa thực đơn." } });

    const changes = request.body;
    if ([changes.sku, changes.name, changes.category].some((value) => value !== undefined && !value.trim())) {
      return reply.code(422).send({ error: { code: "VALIDATION_ERROR", message: "Mã món, tên và danh mục không được để trống." } });
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx.select().from(products).where(eq(products.id, request.params.id)).for("update").limit(1);
        if (!existing) return null;

        await tx.update(products).set({
          ...(changes.sku !== undefined && { sku: changes.sku.trim() }),
          ...(changes.name !== undefined && { name: changes.name.trim() }),
          ...(changes.category !== undefined && { category: changes.category.trim() }),
          ...(changes.menuType !== undefined && { menuType: changes.menuType.trim() }),
          ...(changes.image !== undefined && { imageUrl: changes.image || null }),
          ...(changes.tag !== undefined && { tag: changes.tag || null }),
          ...(changes.price !== undefined && { salePriceVnd: changes.price }),
          ...(changes.cost !== undefined && { costPriceVnd: changes.cost }),
          updatedAt: new Date(),
        }).where(eq(products.id, request.params.id));

        if (changes.stock !== undefined) {
          const [current] = await tx.select({ stock: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`.mapWith(Number) })
            .from(inventoryMovements).where(eq(inventoryMovements.productId, request.params.id));
          const delta = changes.stock - current.stock;
          if (delta !== 0) {
            await tx.insert(inventoryMovements).values({
              productId: request.params.id,
              quantityDelta: delta,
              reason: "manual_adjustment",
              note: "Điều chỉnh tồn kho từ thực đơn",
              createdByName: account.displayName,
            });
          }
        }

        const [updated] = await tx.select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          category: products.category,
          menuType: products.menuType,
          imageUrl: products.imageUrl,
          tag: products.tag,
          price: products.salePriceVnd,
          cost: products.costPriceVnd,
          stock: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`.mapWith(Number),
        }).from(products).leftJoin(inventoryMovements, eq(inventoryMovements.productId, products.id))
          .where(eq(products.id, request.params.id)).groupBy(products.id);
        return updated;
      });

      if (!result) return reply.code(404).send({ error: { code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy món." } });
      return { product: publicProduct(result) };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: { code: "SKU_CONFLICT", message: "Mã SKU đã tồn tại." } });
      }
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>("/products/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    const account = await getSessionAccount(request);
    if (!account) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập." } });
    if (account.role === "cashier") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Bạn không có quyền sửa thực đơn." } });

    const [deactivated] = await db.update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(products.id, request.params.id), eq(products.isActive, true)))
      .returning({ id: products.id });

    if (!deactivated) return reply.code(404).send({ error: { code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy hàng hóa." } });
    return reply.code(204).send();
  });
};
