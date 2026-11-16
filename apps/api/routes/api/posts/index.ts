import { defineHandler } from "void";
import { and, count, desc, eq, inArray, sql, db } from "void/db";
import { category, post, postTag, tag } from "@schema";
import { postListColumns, tagsForPosts, toPostListItem } from "../../../src/lib/post.ts";
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
    .select(postListColumns)
    .from(post)
    .leftJoin(category, eq(post.categoryId, category.id))
    .where(where)
    .orderBy(desc(post.publishedAt), desc(post.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  // Category comes from the join above; tags need one extra query for the whole
  // page. Both keep the response complete, so a consumer like the static site
  // never has to fetch each post's detail to render a list.
  const tagsByPost = await tagsForPosts(rows.map((row) => row.id));
  const items = rows.map((row) => toPostListItem(row, tagsByPost.get(row.id) ?? []));

  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
});
