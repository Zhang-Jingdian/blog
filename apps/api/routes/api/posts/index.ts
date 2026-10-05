import { defineHandler } from "void";
import { count, db, desc, eq } from "void/db";
import { categories, posts } from "@schema";
import { postColumns } from "../../../src/posts";
import { listQuerySchema } from "../../../src/validation";

// GET /api/posts — published posts, newest first, paginated.
export const GET = defineHandler.withValidator({ query: listQuerySchema })(async (
  _c,
  { query },
) => {
  const { page, limit } = query;
  const published = eq(posts.status, "published");

  const [totalRow] = await db.select({ value: count() }).from(posts).where(published);
  const items = await db
    .select(postColumns)
    .from(posts)
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .where(published)
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const total = totalRow?.value ?? 0;
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
});
