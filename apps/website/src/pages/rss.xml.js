import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import { listFullBlogs, renderMarkdown } from "../lib/api";

export async function GET(context) {
  const posts = await listFullBlogs();
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      title: post.title,
      description: post.description ?? "",
      pubDate: new Date(post.publishedAt),
      link: `/blog/${post.slug}/`,
      content: renderMarkdown(post.content),
    })),
  });
}
