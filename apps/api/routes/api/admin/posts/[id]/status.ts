import { defineHandler } from "void";
import { asc, eq, db } from "void/db";
import { post, postTag } from "@schema";
import { iso } from "../../../../../src/lib/date.ts";
import { AppError } from "../../../../../src/lib/error.ts";
import { idParams, patchStatusBody } from "../../../../../src/lib/schemas.ts";

// PATCH /api/admin/posts/:id/status — flip draft/published, pinning publishedAt.
export const PATCH = defineHandler.withValidator({
  params: idParams,
  body: patchStatusBody,
})(async (_c, { params: { id }, body }) => {
  const existing = await db.select().from(post).where(eq(post.id, id)).get();
  if (!existing) throw new AppError(404, "Post not found");

  // publishedAt is written the first time a post becomes published and never
  // changes afterwards, even across draft/publish cycles.
  const publishedAt =
    body.status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt;

  const [row] = await db
    .update(post)
    .set({ status: body.status, publishedAt })
    .where(eq(post.id, id))
    .returning();

  const tagRows = await db
    .select({ tagId: postTag.tagId })
    .from(postTag)
    .where(eq(postTag.postId, id))
    .orderBy(asc(postTag.tagId))
    .all();
  const tagIds = tagRows.map((r) => r.tagId);

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
});
