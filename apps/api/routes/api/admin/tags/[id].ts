import { defineHandler } from "void";
import { eq, db } from "void/db";
import { postTag, tag } from "@schema";
import { AppError } from "../../../../src/lib/error.ts";
import { idParams, taxonomyBody } from "../../../../src/lib/schemas.ts";
import { assertTaxonomyUnique, serializeTaxonomy } from "../../../../src/lib/taxonomy.ts";

// PUT /api/admin/tags/:id — slug defaults to the current value.
export const PUT = defineHandler.withValidator({ params: idParams, body: taxonomyBody })(async (
  _c,
  { params: { id }, body },
) => {
  const existing = await db.select().from(tag).where(eq(tag.id, id)).get();
  if (!existing) throw new AppError(404, "Not found");

  const slug = body.slug ?? existing.slug;
  await assertTaxonomyUnique(tag, body.name, slug, id);

  const [row] = await db
    .update(tag)
    .set({ name: body.name, slug, description: body.description ?? null })
    .where(eq(tag.id, id))
    .returning();
  return serializeTaxonomy(row);
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
