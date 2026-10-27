import { defineHandler } from "void";
import { eq, db } from "void/db";
import { post } from "@schema";
import { AppError } from "../../../../../src/lib/error.ts";
import { idParams, patchStatusBody } from "../../../../../src/lib/schemas.ts";
import {
  getPostById,
  resolvePublishedAt,
  tagIdsForPost,
  toPostObject,
} from "../../../../../src/lib/post.ts";

// PATCH /api/admin/posts/:id/status — flip draft/published, pinning publishedAt.
export const PATCH = defineHandler.withValidator({
  params: idParams,
  body: patchStatusBody,
})(async (_c, { params: { id }, body }) => {
  const existing = await getPostById(id);
  if (!existing) throw new AppError(404, "Post not found");

  const publishedAt = resolvePublishedAt(body.status, existing.publishedAt);

  const [row] = await db
    .update(post)
    .set({ status: body.status, publishedAt })
    .where(eq(post.id, id))
    .returning();

  return toPostObject(row, await tagIdsForPost(id));
});
