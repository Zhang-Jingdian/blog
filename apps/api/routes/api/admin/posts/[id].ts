import { defineHandler } from "void";
import { eq, db } from "void/db";
import { post, postTag } from "@schema";
import { AppError } from "../../../../src/lib/error.ts";
import { idParams, postBody } from "../../../../src/lib/schemas.ts";
import {
  getPostById,
  resolvePublishedAt,
  resolveRefs,
  slugExists,
  tagIdsForPost,
  toPostObject,
} from "../../../../src/lib/post.ts";

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
