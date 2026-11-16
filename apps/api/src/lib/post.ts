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

// Columns a list row needs, with its category resolved through a left join. The
// public list endpoint and the feed share them so the site never has to fetch a
// post per row just to render a list.
export const postListColumns = {
  id: post.id,
  title: post.title,
  slug: post.slug,
  description: post.description,
  coverUrl: post.coverUrl,
  publishedAt: post.publishedAt,
  updatedAt: post.updatedAt,
  categoryName: category.name,
  categorySlug: category.slug,
};

export interface TaxonomyRef {
  name: string;
  slug: string;
}

export interface PostListItem {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  category: TaxonomyRef | null;
  tags: TaxonomyRef[];
}

interface PostListRow {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  categoryName: string | null;
  categorySlug: string | null;
}

// Tags for a whole page of posts in a single query, keyed by post id.
export async function tagsForPosts(postIds: number[]): Promise<Map<number, TaxonomyRef[]>> {
  const grouped = new Map<number, TaxonomyRef[]>();
  if (postIds.length === 0) return grouped;

  const rows = await db
    .select({ postId: postTag.postId, name: tag.name, slug: tag.slug })
    .from(postTag)
    .innerJoin(tag, eq(postTag.tagId, tag.id))
    .where(inArray(postTag.postId, postIds))
    .orderBy(asc(tag.name))
    .all();

  for (const row of rows) {
    const list = grouped.get(row.postId) ?? [];
    list.push({ name: row.name, slug: row.slug });
    grouped.set(row.postId, list);
  }
  return grouped;
}

export function toPostListItem(row: PostListRow, tags: TaxonomyRef[]): PostListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverUrl: row.coverUrl,
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    category:
      row.categoryName && row.categorySlug
        ? { name: row.categoryName, slug: row.categorySlug }
        : null,
    tags,
  };
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
