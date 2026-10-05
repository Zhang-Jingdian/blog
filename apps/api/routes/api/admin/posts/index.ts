import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { count, db, desc, eq } from "void/db";
import { categories, posts } from "@schema";
import {
  categoryExists,
  getPostById,
  postColumns,
  publishedAtForCreate,
  uniqueSlug,
} from "../../../../src/posts";
import { slugify } from "../../../../src/slug";
import { adminListQuerySchema, createPostSchema } from "../../../../src/validation";

// GET /api/admin/posts — every post (drafts included), most recently edited first.
export const GET = defineHandler.withValidator({ query: adminListQuerySchema })(async (
  c,
  { query },
) => {
  requireAuth(c);

  const { page, limit, status } = query;
  const filter = status ? eq(posts.status, status) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(posts).where(filter);
  const items = await db
    .select(postColumns)
    .from(posts)
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .where(filter)
    .orderBy(desc(posts.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const total = totalRow?.value ?? 0;
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
});

// POST /api/admin/posts — create a post authored by the signed-in user.
export const POST = defineHandler.withValidator({ body: createPostSchema })(async (c, { body }) => {
  const user = requireAuth(c);

  if (body.categoryId != null && !(await categoryExists(body.categoryId))) {
    return c.json({ error: `Unknown categoryId: ${body.categoryId}` }, 400);
  }

  const slug = await uniqueSlug(body.slug ?? slugify(body.title));
  const now = new Date();
  const [created] = await db
    .insert(posts)
    .values({
      title: body.title,
      slug,
      description: body.description ?? null,
      content: body.content,
      coverUrl: body.coverUrl ?? null,
      status: body.status,
      categoryId: body.categoryId ?? null,
      authorId: user.id,
      publishedAt: publishedAtForCreate(body.status),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: posts.id });

  return c.json(await getPostById(created.id), 201);
});
