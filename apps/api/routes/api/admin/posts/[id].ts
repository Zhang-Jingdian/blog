import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { db, eq } from "void/db";
import { posts } from "@schema";
import {
  categoryExists,
  getPostById,
  publishedAtForUpdate,
  slugTaken,
} from "../../../../src/posts";
import { updatePostSchema } from "../../../../src/validation";

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/admin/posts/:id — one post, any status.
export const GET = defineHandler(async (c) => {
  requireAuth(c);

  const id = parseId(c.req.param("id"));
  if (id === null) return c.json({ error: "Invalid post id" }, 400);

  const post = await getPostById(id);
  if (!post) return c.json({ error: "Post not found" }, 404);
  return post;
});

// PUT /api/admin/posts/:id — partial update.
export const PUT = defineHandler.withValidator({ body: updatePostSchema })(async (c, { body }) => {
  requireAuth(c);

  const id = parseId(c.req.param("id"));
  if (id === null) return c.json({ error: "Invalid post id" }, 400);

  const existing = await getPostById(id);
  if (!existing) return c.json({ error: "Post not found" }, 404);

  if (body.categoryId != null && !(await categoryExists(body.categoryId))) {
    return c.json({ error: `Unknown categoryId: ${body.categoryId}` }, 400);
  }

  const patch: Partial<typeof posts.$inferInsert> = { updatedAt: new Date() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.content !== undefined) patch.content = body.content;
  if (body.coverUrl !== undefined) patch.coverUrl = body.coverUrl;
  if (body.status !== undefined) patch.status = body.status;
  if (body.categoryId !== undefined) patch.categoryId = body.categoryId;

  if (body.slug !== undefined && body.slug !== existing.slug) {
    if (await slugTaken(body.slug, id)) {
      return c.json({ error: `Slug "${body.slug}" is already in use` }, 409);
    }
    patch.slug = body.slug;
  }

  const publishedAt = publishedAtForUpdate(body.status, existing.publishedAt);
  if (publishedAt !== undefined) patch.publishedAt = publishedAt;

  await db.update(posts).set(patch).where(eq(posts.id, id));
  return getPostById(id);
});

// DELETE /api/admin/posts/:id — 204 on success, 404 when missing.
export const DELETE = defineHandler(async (c) => {
  requireAuth(c);

  const id = parseId(c.req.param("id"));
  if (id === null) return c.json({ error: "Invalid post id" }, 400);

  const deleted = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
  if (deleted.length === 0) return c.json({ error: "Post not found" }, 404);
  return c.body(null, 204);
});
