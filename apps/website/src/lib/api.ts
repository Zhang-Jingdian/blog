import { marked } from "marked";

// Fetch the posts API. Under SSG this runs at build time, so each page is
// generated from a snapshot of the API. Point VITE_API_BASE_URL at a running
// dev server or a deployed Worker before building.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export interface PostListItem {
  id: number;
  title: string;
  slug: string;
  coverUrl: string | null;
  publishedAt: string;
}

export interface Post extends PostListItem {
  description: string | null;
  content: string;
  updatedAt: string;
  category: { name: string; slug: string } | null;
  tags: { name: string; slug: string }[];
}

export interface PostListResult {
  items: PostListItem[];
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

export interface PostListParams {
  q?: string;
  category?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export async function listPosts(params: PostListParams = {}): Promise<PostListResult> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.tag) search.set("tag", params.tag);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return get<PostListResult>(`/api/posts${qs ? `?${qs}` : ""}`);
}

// Walk the paginated list to collect every published post (list fields only).
export async function listAllPosts(): Promise<PostListItem[]> {
  const items: PostListItem[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const list = await listPosts({ page, pageSize: 50 });
    items.push(...list.items);
    totalPages = list.totalPages;
    page += 1;
  } while (page <= totalPages);
  return items;
}

export async function getPost(slug: string): Promise<Post | null> {
  const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(slug)}`);
  // 404 → the post doesn't exist (or is a draft); return null so the page can 404.
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`API request failed: GET /api/posts/${slug} → ${res.status}`);
  }
  const body = (await res.json()) as Envelope<Post>;
  return body.data;
}

// Full posts (with body/category/tags) for consumers that need them, e.g. RSS.
export async function listFullPosts(): Promise<Post[]> {
  const items = await listAllPosts();
  const posts = await Promise.all(items.map((item) => getPost(item.slug)));
  return posts.filter((post): post is Post => post !== null);
}

export function renderMarkdown(content: string): string {
  return marked.parse(content, { async: false }) as string;
}
