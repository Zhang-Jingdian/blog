import { and, asc, eq, inArray, ne, db } from "void/db";
import { category, post, postTag, tag } from "@schema";
import { iso } from "./date.ts";
import { AppError } from "./error.ts";

export type PostRow = typeof post.$inferSelect;

export async function getPostById(id: number): Promise<PostRow | undefined> {
  return db.select().from(post).where(eq(post.id, id)).get();
}

export async function tagIdsForPost(postId: number): Promise<number[]> {
  const rows = await db
    .select({ tagId: postTag.tagId })
    .from(postTag)
    .where(eq(postTag.postId, postId))
    .orderBy(asc(postTag.tagId))
    .all();
  return rows.map((r) => r.tagId);
}

export async function slugExists(slug: string, excludeId?: number): Promise<boolean> {
  return (
    (await db
      .select({ id: post.id })
      .from(post)
      .where(
        excludeId === undefined
          ? eq(post.slug, slug)
          : and(eq(post.slug, slug), ne(post.id, excludeId)),
      )
      .get()) !== undefined
  );
}

// Validate category/tag references and de-duplicate tag ids.
export async function resolveRefs(
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
export function resolvePublishedAt(
  status: "draft" | "published",
  existing: Date | null,
): Date | null {
  return status === "published" ? (existing ?? new Date()) : existing;
}

export function toPostObject(row: PostRow, tagIds: number[]) {
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
