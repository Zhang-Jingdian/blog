import { defineHandler } from "void";
import { and, count, desc, eq, inArray, isNull, sql, db } from "void/db";
import { category, post, postTag, tag } from "@schema";
import { iso } from "../../../../src/lib/date.ts";
import { AppError } from "../../../../src/lib/error.ts";
import { adminListQuery, postBody } from "../../../../src/lib/schemas.ts";
import { slugify } from "../../../../src/lib/slug.ts";

type Condition = ReturnType<typeof eq>;

// GET /api/admin/posts — list with drafts, search, and category/tag filters.
export const GET = defineHandler.withValidator({ query: adminListQuery })(async (_c, { query }) => {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;

  // Literal, case-insensitive substring match: `%` and `_` are treated as plain
  // characters (the contract forbids wildcard semantics), hence instr + lower.
  const conds: Condition[] = [];
  if (query.status === "draft" || query.status === "published") {
    conds.push(eq(post.status, query.status));
  }
  if (query.q) {
    conds.push(
      sql`(instr(lower(${post.title}), lower(${query.q})) > 0 OR instr(lower(${post.description}), lower(${query.q})) > 0)`,
    );
  }
  if (query.category === "none") {
    conds.push(isNull(post.categoryId));
  } else if (query.category) {
    conds.push(
      inArray(
        post.categoryId,
        db.select({ id: category.id }).from(category).where(eq(category.slug, query.category)),
      ),
    );
  }
  if (query.tag) {
    conds.push(
      inArray(
        post.id,
        db
          .select({ postId: postTag.postId })
          .from(postTag)
          .innerJoin(tag, eq(postTag.tagId, tag.id))
          .where(eq(tag.slug, query.tag)),
      ),
    );
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const countBase = db.select({ c: count() }).from(post);
  const total = (await (where ? countBase.where(where) : countBase).get())?.c ?? 0;

  const select = db
    .select({
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      coverUrl: post.coverUrl,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      categoryName: category.name,
      categorySlug: category.slug,
    })
    .from(post)
    .leftJoin(category, eq(post.categoryId, category.id));
  const rows = await (where ? select.where(where) : select)
    .orderBy(desc(post.updatedAt), desc(post.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    coverUrl: r.coverUrl,
    publishedAt: iso(r.publishedAt),
    updatedAt: r.updatedAt.toISOString(),
    category:
      r.categoryName !== null && r.categorySlug !== null
        ? { name: r.categoryName, slug: r.categorySlug }
        : null,
  }));

  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
});

// POST /api/admin/posts — create a post with category and tag references.
export const POST = defineHandler.withValidator({ body: postBody })(async (c, { body }) => {
  const slug = body.slug ?? slugify(body.title);
  if (!slug) throw new AppError(400, "Cannot generate a slug from the title");
  if (await db.select({ id: post.id }).from(post).where(eq(post.slug, slug)).get()) {
    throw new AppError(409, "Slug already exists");
  }

  const categoryId = body.categoryId ?? null;
  if (
    categoryId !== null &&
    !(await db.select({ id: category.id }).from(category).where(eq(category.id, categoryId)).get())
  ) {
    throw new AppError(400, "Category not found");
  }
  const tagIds = [...new Set(body.tagIds ?? [])];
  if (tagIds.length > 0) {
    const found = await db.select({ id: tag.id }).from(tag).where(inArray(tag.id, tagIds)).all();
    if (found.length !== tagIds.length) throw new AppError(400, "Tag not found");
  }

  const status = body.status ?? "draft";
  // D1 has no interactive transactions, so the post and its links are written
  // sequentially. `tagIds` are validated to exist above.
  const [row] = await db
    .insert(post)
    .values({
      title: body.title,
      slug,
      description: body.description ?? null,
      content: body.content,
      coverUrl: body.coverUrl ?? null,
      status,
      categoryId,
      publishedAt: status === "published" ? new Date() : null,
    })
    .returning();
  if (tagIds.length > 0) {
    await db.insert(postTag).values(tagIds.map((tagId) => ({ postId: row.id, tagId })));
  }

  return c.json(
    {
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
    },
    201,
  );
});
