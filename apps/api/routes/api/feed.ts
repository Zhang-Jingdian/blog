import { defineHandler } from "void";
import { desc, eq, db } from "void/db";
import { category, post } from "@schema";
import { postListColumns, tagsForPosts, toPostListItem } from "../../src/lib/post.ts";

// GET /api/feed — every published post with its body, newest first.
//
// The static site needs all post bodies twice per build (RSS and the blog pages'
// static paths). This returns them in one query instead of making the site list
// posts and then request each one, which grew linearly with the number of posts.
// It lives at /api/feed rather than /api/posts/feed so a post whose slug is
// "feed" does not shadow it.
export const GET = defineHandler(async () => {
  const rows = await db
    .select({ ...postListColumns, content: post.content })
    .from(post)
    .leftJoin(category, eq(post.categoryId, category.id))
    .where(eq(post.status, "published"))
    .orderBy(desc(post.publishedAt), desc(post.id))
    .all();

  const tagsByPost = await tagsForPosts(rows.map((row) => row.id));
  const items = rows.map((row) => ({
    ...toPostListItem(row, tagsByPost.get(row.id) ?? []),
    content: row.content,
  }));

  return { items };
});
