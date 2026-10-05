// Post helpers shared by the public and admin routes: a single select shape
// (so every response looks the same), slug de-duplication, category checks and
// the publish-timestamp rules from docs/db.md.
import { db, eq, like } from "void/db";
import { categories, posts } from "@schema";

// Columns returned for every post, with its category joined in.
export const postColumns = {
  id: posts.id,
  title: posts.title,
  slug: posts.slug,
  description: posts.description,
  content: posts.content,
  coverUrl: posts.coverUrl,
  status: posts.status,
  categoryId: posts.categoryId,
  authorId: posts.authorId,
  publishedAt: posts.publishedAt,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  category: {
    id: categories.id,
    name: categories.name,
    slug: categories.slug,
  },
};

export type PostRow = Awaited<ReturnType<typeof getPostById>>;

/** Load one post (any status) with its category, or null. */
export async function getPostById(id: number) {
  const rows = await db
    .select(postColumns)
    .from(posts)
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .where(eq(posts.id, id));
  return rows[0] ?? null;
}

/** True when `slug` is used by a post other than `excludeId`. */
export async function slugTaken(slug: string, excludeId?: number): Promise<boolean> {
  const rows = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug));
  return rows.some((row) => row.id !== excludeId);
}

/** Return `base`, or `base-2`, `base-3`… until it is free. */
export async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  const rows = await db
    .select({ id: posts.id, slug: posts.slug })
    .from(posts)
    .where(like(posts.slug, `${base}%`));
  const taken = new Set(rows.filter((row) => row.id !== excludeId).map((row) => row.slug));

  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function categoryExists(id: number): Promise<boolean> {
  const rows = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id));
  return rows.length > 0;
}

/** A freshly created post gets `publishedAt` only when it is published. */
export function publishedAtForCreate(status: "draft" | "published"): Date | null {
  return status === "published" ? new Date() : null;
}

/**
 * On update: stamp `publishedAt` on the first transition to published; keep the
 * existing value otherwise (including when reverting to draft).
 * `undefined` means "leave the column unchanged".
 */
export function publishedAtForUpdate(
  status: "draft" | "published" | undefined,
  current: Date | null,
): Date | undefined {
  return status === "published" && current === null ? new Date() : undefined;
}
