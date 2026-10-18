import { defineHandler } from "void";
import { and, asc, eq, inArray, ne, db } from "void/db";
import { category, post, postTag, tag } from "@schema";
import { iso } from "../../../../src/lib/date.ts";
import { AppError } from "../../../../src/lib/error.ts";
import { idParams, postBody } from "../../../../src/lib/schemas.ts";

type PostRow = typeof post.$inferSelect;
type Condition = ReturnType<typeof eq>;

async function getPostById(id: number): Promise<PostRow | undefined> {
  return db.select().from(post).where(eq(post.id, id)).get();
}

async function tagIdsForPost(postId: number): Promise<number[]> {
  const rows = await db
    .select({ tagId: postTag.tagId })
    .from(postTag)
    .where(eq(postTag.postId, postId))
    .orderBy(asc(postTag.tagId))
    .all();
  return rows.map((r) => r.tagId);
}

async function slugExists(slug: string, excludeId?: number): Promise<boolean> {
  const conds: Condition[] = [eq(post.slug, slug)];
  if (excludeId !== undefined) conds.push(ne(post.id, excludeId));
  return (
    (await db
      .select({ id: post.id })
      .from(post)
      .where(and(...conds))
      .get()) !== undefined
  );
}

// Validate category/tag references and de-duplicate tag ids.
async function resolveRefs(
  categoryId: number | null | undefined,
  tagIds: number[] | undefined,
): Promise<{ categoryId: number | null; tagIds: number[] }> {
  const resolvedCategory = categoryId ?? null;
  if (
    resolvedCategory !== null &&
    !(await db.select().from(category).where(eq(category.id, resolvedCategory)).get())
  ) {
    throw new AppError(400, "Category not found");
  }
  const resolvedTags = [...new Set(tagIds ?? [])];
  if (resolvedTags.length > 0) {
    const found = await db
      .select({ id: tag.id })
      .from(tag)
      .where(inArray(tag.id, resolvedTags))
      .all();
    if (found.length !== resolvedTags.length) throw new AppError(400, "Tag not found");
  }
  return { categoryId: resolvedCategory, tagIds: resolvedTags };
}

// publishedAt is written the first time a post becomes published and never
// changes afterwards, even across draft/publish cycles.
function resolvePublishedAt(status: "draft" | "published", existing: Date | null): Date | null {
  return status === "published" ? (existing ?? new Date()) : existing;
}

function toPostObject(row: PostRow, tagIds: number[]) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    content: row.content,
    coverUrl: row.coverUrl,
    status: row.status,
    categoryId: row.categoryId,
    publishedAt: iso(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tagIds,
  };
}

// GET /api/admin/posts/:id
export const GET = defineHandler.withValidator({ params: idParams })(async (
  _c,
  { params: { id } },
) => {
  const row = await getPostById(id);
  if (!row) throw new AppError(404, "Post not found");
  return toPostObject(row, await tagIdsForPost(id));
});

// PUT /api/admin/posts/:id — full replace; slug/status default to current values.
export const PUT = defineHandler.withValidator({ params: idParams, body: postBody })(async (
  _c,
  { params: { id }, body },
) => {
  const existing = await getPostById(id);
  if (!existing) throw new AppError(404, "Post not found");

  const slug = body.slug ?? existing.slug;
  if (await slugExists(slug, id)) throw new AppError(409, "Slug already exists");
  const { categoryId, tagIds } = await resolveRefs(body.categoryId, body.tagIds);

  const status = body.status ?? existing.status;
  const [row] = await db
    .update(post)
    .set({
      title: body.title,
      slug,
      description: body.description ?? null,
      content: body.content,
      coverUrl: body.coverUrl ?? null,
      status,
      categoryId,
      publishedAt: resolvePublishedAt(status, existing.publishedAt),
      updatedAt: new Date(),
    })
    .where(eq(post.id, id))
    .returning();
  await db.delete(postTag).where(eq(postTag.postId, id));
  if (tagIds.length > 0) {
    await db.insert(postTag).values(tagIds.map((tagId) => ({ postId: id, tagId })));
  }

  return toPostObject(row, tagIds);
});

// DELETE /api/admin/posts/:id
export const DELETE = defineHandler.withValidator({ params: idParams })(async (
  _c,
  { params: { id } },
) => {
  const existing = await getPostById(id);
  if (!existing) throw new AppError(404, "Post not found");
  // D1 does not guarantee FK enforcement, so remove the links explicitly rather
  // than relying on the ON DELETE CASCADE declared in the schema.
  await db.delete(postTag).where(eq(postTag.postId, id));
  await db.delete(post).where(eq(post.id, id));
  return { deleted: true };
});
