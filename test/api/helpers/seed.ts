import { category, post, postTag, tag } from "../../../apps/api/db/schema.ts";
import type { TestDb } from "./db.ts";

interface CategoryInput {
  name: string;
  slug?: string;
  description?: string | null;
}

interface TagInput {
  name: string;
  slug?: string;
  description?: string | null;
}

interface PostInput {
  title: string;
  slug?: string;
  description?: string | null;
  content?: string;
  coverUrl?: string | null;
  status?: "draft" | "published";
  categoryId?: number | null;
  tagIds?: number[];
  publishedAt?: Date | null;
}

export async function createCategory(db: TestDb, input: CategoryInput) {
  const [row] = await db
    .insert(category)
    .values({
      name: input.name,
      slug: input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      description: input.description ?? null,
    })
    .returning();
  return row;
}

export async function createTag(db: TestDb, input: TagInput) {
  const [row] = await db
    .insert(tag)
    .values({
      name: input.name,
      slug: input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      description: input.description ?? null,
    })
    .returning();
  return row;
}

export async function createPost(db: TestDb, input: PostInput) {
  const status = input.status ?? "draft";
  const [row] = await db
    .insert(post)
    .values({
      title: input.title,
      slug: input.slug ?? input.title.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      description: input.description ?? null,
      content: input.content ?? "content",
      coverUrl: input.coverUrl ?? null,
      status,
      categoryId: input.categoryId ?? null,
      publishedAt:
        status === "published" ? (input.publishedAt ?? new Date("2026-01-01T00:00:00.000Z")) : null,
    })
    .returning();

  for (const tagId of input.tagIds ?? []) {
    db.insert(postTag).values({ postId: row.id, tagId }).run();
  }

  return row;
}
