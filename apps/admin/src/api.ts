// Typed wrapper around the Void API. Response shapes mirror apps/api routes.

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  content: string;
  coverUrl: string | null;
  status: "draft" | "published";
  categoryId: number | null;
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: number; name: string; slug: string } | null;
}

export interface PostInput {
  title: string;
  slug?: string;
  description?: string | null;
  content: string;
  coverUrl?: string | null;
  status?: "draft" | "published";
  categoryId?: number | null;
}

export interface PostList {
  items: Post[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${BASE}${path}`, { credentials: "include", ...init, headers });

  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export function listPosts(
  params: { page?: number; limit?: number; status?: "draft" | "published" } = {},
) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return request<PostList>(`/api/admin/posts${query ? `?${query}` : ""}`);
}

export const getPost = (id: number | string) => request<Post>(`/api/admin/posts/${id}`);

export const createPost = (input: PostInput) =>
  request<Post>("/api/admin/posts", { method: "POST", body: JSON.stringify(input) });

export const updatePost = (id: number | string, input: Partial<PostInput>) =>
  request<Post>(`/api/admin/posts/${id}`, { method: "PUT", body: JSON.stringify(input) });

export const deletePost = (id: number | string) =>
  request<void>(`/api/admin/posts/${id}`, { method: "DELETE" });

export const listCategories = () => request<{ items: Category[] }>("/api/categories");
