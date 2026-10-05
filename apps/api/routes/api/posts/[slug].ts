import { defineHandler } from "void";
import { and, db, eq } from "void/db";
import { categories, posts } from "@schema";
import { postColumns } from "../../../src/posts";

// GET /api/posts/:slug — a single published post.
export const GET = defineHandler(async (c) => {
  const slug = c.req.param("slug");
  if (!slug) return c.json({ error: "Post not found" }, 404);

  const rows = await db
    .select(postColumns)
    .from(posts)
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")));

  const post = rows[0];
  if (!post) return c.json({ error: "Post not found" }, 404);
  return post;
});
