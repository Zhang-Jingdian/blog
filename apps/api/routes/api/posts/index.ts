import { defineHandler } from "void";
import { and, count, desc, eq, inArray, sql, db } from "void/db";
import { category, post, postTag, tag } from "@schema";
import { iso } from "../../../src/lib/date.ts";
import { publicListQuery } from "../../../src/lib/schemas.ts";

// GET /api/posts — published posts only, newest first, with search and
// category/tag filters combined by AND.
export const GET = defineHandler.withValidator({ query: publicListQuery })(async (
  _c,
  { query },
) => {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;

  // Literal, case-insensitive substring match: `%` and `_` are treated as plain
  // characters (the contract forbids wildcard semantics), hence instr + lower.
  const conds: ReturnType<typeof eq>[] = [eq(post.status, "published")];
  if (query.q) {
    conds.push(
      sql`(instr(lower(${post.title}), lower(${query.q})) > 0 OR instr(lower(${post.description}), lower(${query.q})) > 0)`,
    );
  }
  if (query.category) {
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
  const where = and(...conds);

  const total = (await db.select({ c: count() }).from(post).where(where).get())?.c ?? 0;
  const rows = await db
    .select({
      id: post.id,
      title: post.title,
      slug: post.slug,
      coverUrl: post.coverUrl,
      publishedAt: post.publishedAt,
    })
    .from(post)
    .where(where)
    .orderBy(desc(post.publishedAt), desc(post.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    coverUrl: r.coverUrl,
    publishedAt: iso(r.publishedAt),
  }));

  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
});
