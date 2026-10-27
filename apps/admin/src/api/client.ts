import type {
  Post,
  PostInput,
  PostListResult,
  Taxonomy,
  TaxonomyInput,
  TaxonomyKind,
} from "./types";

// Empty in dev (Vite proxies /api to the local API); production sets
// VITE_API_BASE_URL via CI (.github/workflows/deploy.yml) to the deployed API Worker.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiError extends Error {
  readonly issues?: unknown;

  constructor(message: string, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.issues = issues;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // `credentials: "include"` sends the Cloudflare Access CF_Authorization cookie
  // with every cross-origin call so the browser can authenticate past Access.
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: "include" });
  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await res.json()) as Envelope<T>;
  } catch {
    envelope = null;
  }
  if (!res.ok) {
    throw new ApiError(envelope?.message ?? `Request failed (${res.status})`, envelope?.data);
  }
  if (!envelope) throw new ApiError("Invalid response");
  return envelope.data;
}

function jsonInit(method: string, body?: unknown): RequestInit {
  if (body === undefined) return { method };
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function listPosts(query?: {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<PostListResult> {
  const params = new URLSearchParams();
  if (query?.status && query.status !== "all") params.set("status", query.status);
  if (query?.q) params.set("q", query.q);
  if (query?.page && query.page > 1) params.set("page", String(query.page));
  if (query?.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return request<PostListResult>(`/api/admin/posts${qs ? `?${qs}` : ""}`);
}

export function getPost(id: number): Promise<Post> {
  return request<Post>(`/api/admin/posts/${id}`);
}

export function createPost(input: PostInput): Promise<Post> {
  return request<Post>("/api/admin/posts", jsonInit("POST", input));
}

export function updatePost(id: number, input: PostInput): Promise<Post> {
  return request<Post>(`/api/admin/posts/${id}`, jsonInit("PUT", input));
}

export function deletePost(id: number): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/admin/posts/${id}`, { method: "DELETE" });
}

export function uploadCover(file: Blob): Promise<{ url: string }> {
  return request<{ url: string }>("/api/admin/uploads", {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
}

const taxonomyPath = (kind: TaxonomyKind) => (kind === "tag" ? "tags" : "categories");

export function listTaxonomy(kind: TaxonomyKind): Promise<Taxonomy[]> {
  return request<Taxonomy[]>(`/api/admin/${taxonomyPath(kind)}`);
}

export const listCategories = (): Promise<Taxonomy[]> => listTaxonomy("category");

export const listTags = (): Promise<Taxonomy[]> => listTaxonomy("tag");

export function createTaxonomy(kind: TaxonomyKind, input: TaxonomyInput): Promise<Taxonomy> {
  return request<Taxonomy>(`/api/admin/${taxonomyPath(kind)}`, jsonInit("POST", input));
}

export function updateTaxonomy(
  kind: TaxonomyKind,
  id: number,
  input: TaxonomyInput,
): Promise<Taxonomy> {
  return request<Taxonomy>(`/api/admin/${taxonomyPath(kind)}/${id}`, jsonInit("PUT", input));
}

export function deleteTaxonomy(
  kind: TaxonomyKind,
  id: number,
): Promise<{ deleted: boolean; affectedPosts?: number }> {
  return request<{ deleted: boolean; affectedPosts?: number }>(
    `/api/admin/${taxonomyPath(kind)}/${id}`,
    { method: "DELETE" },
  );
}
