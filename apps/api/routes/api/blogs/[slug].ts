import { defineHandler } from "void";
import { and, asc, eq, db } from "void/db";
import { category, post, postTag, tag } from "@schema";
import { iso } from "../../../src/lib/date.ts";
import { AppError } from "../../../src/lib/error.ts";

// GET /api/blogs/:slug — a single published post with its category and tags.
export const GET = defineHandler(async (c) => {
  const slug = c.req.param("slug")!;

  const row = await db
    .select()
    .from(post)
    .where(and(eq(post.slug, slug), eq(post.status, "published")))
    .get();
  if (!row) throw new AppError(404, "Post not found");

  const cat =
    row.categoryId !== null
      ? await db.select().from(category).where(eq(category.id, row.categoryId)).get()
      : undefined;
  const tags = await db
    .select({ name: tag.name, slug: tag.slug })
    .from(tag)
    .innerJoin(postTag, eq(postTag.tagId, tag.id))
    .where(eq(postTag.postId, row.id))
    .orderBy(asc(tag.name))
    .all();

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    content: row.content,
    coverUrl: row.coverUrl,
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    category: cat ? { name: cat.name, slug: cat.slug } : null,
    tags,
  };
});
