import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import { listFullPosts, renderMarkdown } from "../lib/api";

export async function GET(context) {
  const posts = await listFullPosts();
  const items = await Promise.all(
    posts.map(async (post) => ({
      title: post.title,
      description: post.description ?? "",
      pubDate: new Date(post.publishedAt),
      link: `/blog/${post.slug}/`,
      content: await renderMarkdown(post.content),
    })),
  );
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items,
  });
}
