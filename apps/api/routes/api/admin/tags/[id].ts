import { defineHandler } from "void";
import { and, eq, ne, db } from "void/db";
import { postTag, tag } from "@schema";
import { AppError } from "../../../../src/lib/error.ts";
import { idParams, taxonomyBody } from "../../../../src/lib/schemas.ts";

function serialize(row: typeof tag.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// PUT /api/admin/tags/:id — slug defaults to the current value.
export const PUT = defineHandler.withValidator({ params: idParams, body: taxonomyBody })(async (
  _c,
  { params: { id }, body },
) => {
  const existing = await db.select().from(tag).where(eq(tag.id, id)).get();
  if (!existing) throw new AppError(404, "Not found");

  const slug = body.slug ?? existing.slug;
  if (
    await db
      .select({ id: tag.id })
      .from(tag)
      .where(and(eq(tag.slug, slug), ne(tag.id, id)))
      .get()
  ) {
    throw new AppError(409, "Slug already exists");
  }
  if (
    await db
      .select({ id: tag.id })
      .from(tag)
      .where(and(eq(tag.name, body.name), ne(tag.id, id)))
      .get()
  ) {
    throw new AppError(409, "Name already exists");
  }

  const [row] = await db
    .update(tag)
    .set({ name: body.name, slug, description: body.description ?? null, updatedAt: new Date() })
    .where(eq(tag.id, id))
    .returning();
  return serialize(row);
});

// DELETE /api/admin/tags/:id
export const DELETE = defineHandler.withValidator({ params: idParams })(async (
  _c,
  { params: { id } },
) => {
  const existing = await db.select().from(tag).where(eq(tag.id, id)).get();
  if (!existing) throw new AppError(404, "Tag not found");

  // D1 does not guarantee FK enforcement, so remove the links explicitly rather
  // than relying on the ON DELETE CASCADE declared in the schema.
  await db.delete(postTag).where(eq(postTag.tagId, id));
  await db.delete(tag).where(eq(tag.id, id));
  return { deleted: true };
});
