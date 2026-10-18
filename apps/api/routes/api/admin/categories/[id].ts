import { defineHandler } from "void";
import { and, count, eq, ne, db } from "void/db";
import { category, post } from "@schema";
import { AppError } from "../../../../src/lib/error.ts";
import { idParams, taxonomyBody } from "../../../../src/lib/schemas.ts";

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

// PUT /api/admin/categories/:id — slug defaults to the current value.
export const PUT = defineHandler.withValidator({ params: idParams, body: taxonomyBody })(async (
  _c,
  { params: { id }, body },
) => {
  const existing = await db.select().from(category).where(eq(category.id, id)).get();
  if (!existing) throw new AppError(404, "Not found");

  const slug = body.slug ?? existing.slug;
  if (
    await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.slug, slug), ne(category.id, id)))
      .get()
  ) {
    throw new AppError(409, "Slug already exists");
  }
  if (
    await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.name, body.name), ne(category.id, id)))
      .get()
  ) {
    throw new AppError(409, "Name already exists");
  }

  const [row] = await db
    .update(category)
    .set({ name: body.name, slug, description: body.description ?? null, updatedAt: new Date() })
    .where(eq(category.id, id))
    .returning();
  return serialize(row);
});

// DELETE /api/admin/categories/:id — uncategorize its posts and report how many.
export const DELETE = defineHandler.withValidator({ params: idParams })(async (
  _c,
  { params: { id } },
) => {
  const existing = await db.select().from(category).where(eq(category.id, id)).get();
  if (!existing) throw new AppError(404, "Category not found");

  // D1 has no interactive transactions, so these run sequentially; the FK
  // ON DELETE SET NULL only fires on the category delete below.
  const affected =
    (await db.select({ c: count() }).from(post).where(eq(post.categoryId, id)).get())?.c ?? 0;
  await db.update(post).set({ categoryId: null }).where(eq(post.categoryId, id));
  await db.delete(category).where(eq(category.id, id));
  return { deleted: true, affectedPosts: affected };
});
