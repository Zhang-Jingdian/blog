import { marked } from "marked";

// Fetch the blog API. Under SSG this runs at build time, so each page is
// generated from a snapshot of the API. Point VITE_API_BASE_URL at a running
// dev server or a deployed Worker before building.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5173";

export interface BlogListItem {
  id: number;
  title: string;
  slug: string;
  coverUrl: string | null;
  publishedAt: string;
}

export interface BlogPost extends BlogListItem {
  description: string | null;
  content: string;
  updatedAt: string;
  category: { name: string; slug: string } | null;
  tags: { name: string; slug: string }[];
}

export interface BlogListResult {
  items: BlogListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API request failed: GET ${path} → ${res.status}`);
  }
  const body = (await res.json()) as Envelope<T>;
  if (body.code !== res.status) {
    throw new Error(
      `API envelope mismatch: GET ${path} → HTTP ${res.status} but code ${body.code}`,
    );
  }
  return body.data;
}

export interface BlogListParams {
  q?: string;
  category?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export async function listBlogs(params: BlogListParams = {}): Promise<BlogListResult> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.tag) search.set("tag", params.tag);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return get<BlogListResult>(`/api/blogs${qs ? `?${qs}` : ""}`);
}

// Walk the paginated list to collect every published post (list fields only).
export async function listAllItems(): Promise<BlogListItem[]> {
  const items: BlogListItem[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const list = await listBlogs({ page, pageSize: 50 });
    items.push(...list.items);
    totalPages = list.totalPages;
    page += 1;
  } while (page <= totalPages);
  return items;
}

export async function getBlog(slug: string): Promise<BlogPost | null> {
  const res = await fetch(`${API_BASE_URL}/api/blogs/${encodeURIComponent(slug)}`);
  // 404 → the post doesn't exist (or is a draft); return null so the page can 404.
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`API request failed: GET /api/blogs/${slug} → ${res.status}`);
  }
  const body = (await res.json()) as Envelope<BlogPost>;
  return body.data;
}

// Full posts (with body/category/tags) for consumers that need them, e.g. RSS.
export async function listFullBlogs(): Promise<BlogPost[]> {
  const items = await listAllItems();
  const posts = await Promise.all(items.map((item) => getBlog(item.slug)));
  return posts.filter((post): post is BlogPost => post !== null);
}

export function renderMarkdown(content: string): string {
  return marked.parse(content, { async: false }) as string;
}
