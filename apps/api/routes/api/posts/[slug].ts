import { defineHandler } from "void";
import { and, asc, eq, db } from "void/db";
import { category, post, postTag, tag } from "@schema";
import { iso } from "../../../src/lib/date.ts";
import { AppError } from "../../../src/lib/error.ts";

// GET /api/posts/:slug — a single published post with its category and tags.
export const GET = defineHandler(async (c) => {
  const slug = c.req.param("slug")!;

  const row = await db
    .select({
      id: post.id,
      title: post.title,
      slug: post.slug,
      description: post.description,
      content: post.content,
      coverUrl: post.coverUrl,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      categoryName: category.name,
      categorySlug: category.slug,
    })
    .from(post)
    .leftJoin(category, eq(post.categoryId, category.id))
    .where(and(eq(post.slug, slug), eq(post.status, "published")))
    .get();
  if (!row) throw new AppError(404, "Post not found");

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
    category:
      row.categoryName !== null && row.categorySlug !== null
        ? { name: row.categoryName, slug: row.categorySlug }
        : null,
    tags,
  };
});
