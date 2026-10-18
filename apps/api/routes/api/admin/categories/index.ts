import { defineHandler } from "void";
import { asc, count, eq, db } from "void/db";
import { category, post } from "@schema";
import { AppError } from "../../../../src/lib/error.ts";
import { taxonomyBody } from "../../../../src/lib/schemas.ts";
import { slugify } from "../../../../src/lib/slug.ts";

function serialize(row: typeof category.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// GET /api/admin/categories — list by name with postCount (drafts included).
export const GET = defineHandler(async () => {
  const rows = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      postCount: count(post.id),
    })
    .from(category)
    .leftJoin(post, eq(post.categoryId, category.id))
    .groupBy(category.id)
    .orderBy(asc(category.name))
    .all();
  return rows.map((r) => ({ ...serialize(r), postCount: r.postCount }));
});

// POST /api/admin/categories
export const POST = defineHandler.withValidator({ body: taxonomyBody })(async (c, { body }) => {
  const slug = body.slug ?? slugify(body.name);
  if (!slug) throw new AppError(400, "Cannot generate a slug from the name");
  if (await db.select({ id: category.id }).from(category).where(eq(category.slug, slug)).get()) {
    throw new AppError(409, "Slug already exists");
  }
  if (
    await db.select({ id: category.id }).from(category).where(eq(category.name, body.name)).get()
  ) {
    throw new AppError(409, "Name already exists");
  }
  const [row] = await db
    .insert(category)
    .values({ name: body.name, slug, description: body.description ?? null })
    .returning();
  return c.json(serialize(row), 201);
});
