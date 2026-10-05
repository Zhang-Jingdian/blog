import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// `process` is available in the Node context that runs the loader (build / dev
// server), but the app's tsconfig only loads Vite/void ambient types.
declare const process: { env: Record<string, string | undefined> };

// Build-time API base. Void injects VITE_* through the build shell, so this is
// read from the environment during `astro build`; locally it falls back to the
// dev API. Fetching happens server-side, so there is no CORS involved.
const API_BASE = process.env.VITE_API_BASE_URL ?? "http://localhost:8787";

interface ApiPost {
  slug: string;
  title: string;
  description: string | null;
  content: string;
  coverUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  category: { name: string } | null;
}

interface ApiPostPage {
  items: ApiPost[];
  totalPages: number;
}

async function fetchPublishedPosts(): Promise<ApiPost[]> {
  const posts: ApiPost[] = [];
  for (let page = 1; ; page++) {
    const response = await fetch(`${API_BASE}/api/posts?limit=50&page=${page}`);
    if (!response.ok) {
      throw new Error(
        `Failed to load posts from ${API_BASE}/api/posts (${response.status} ${response.statusText})`,
      );
    }
    const body = (await response.json()) as ApiPostPage;
    posts.push(...body.items);
    if (page >= body.totalPages) return posts;
  }
}

const blog = defineCollection({
  // Pull published posts from the API at build time instead of reading local
  // Markdown. Markdown is rendered here so `getCollection` / `render(entry)` and
  // the RSS route keep working unchanged.
  loader: {
    name: "api-posts",
    async load(context) {
      const { store } = context;
      for (const post of await fetchPublishedPosts()) {
        const data = await context.parseData({
          id: post.slug,
          data: {
            title: post.title,
            description: post.description ?? "",
            pubDate: post.publishedAt,
            // The API has no separate "content updated" field, so leave this unset.
            heroImage: post.coverUrl ?? undefined,
            category: post.category?.name,
          },
        });
        const rendered = await context.renderMarkdown(post.content);
        store.set({
          id: post.slug,
          data,
          body: post.content,
          rendered,
          digest: context.generateDigest(post.content),
        });
      }
    },
  },
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    category: z.string().optional(),
  }),
});

export const collections = { blog };
