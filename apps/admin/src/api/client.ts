import type {
  Post,
  PostInput,
  PostListResult,
  Taxonomy,
  TaxonomyInput,
  TaxonomyKind,
  UploadListResult,
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

// Fetch a post export (a zip of `<slug>.md` + `file/` media). The endpoint
// returns raw bytes, so this bypasses the JSON `request` helper and hands back
// the blob plus the server-suggested filename for the browser download.
export async function exportPost(id: number): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/posts/${id}/export`, {
    credentials: "include",
  });
  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new ApiError(message);
  }
  const blob = await res.blob();
  const filename = parseContentDisposition(res.headers.get("content-disposition")) ?? "post.zip";
  return { blob, filename };
}

function parseContentDisposition(header: string | null): string | null {
  if (!header) return null;
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? null;
}

export function uploadImage(file: Blob, postId?: number): Promise<{ url: string; key: string }> {
  const qs = postId ? `?postId=${postId}` : "";
  return request<{ url: string; key: string }>(`/api/admin/uploads${qs}`, {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
}

export function listUploads(query?: {
  q?: string;
  postId?: number;
  page?: number;
  pageSize?: number;
}): Promise<UploadListResult> {
  const params = new URLSearchParams();
  if (query?.q) params.set("q", query.q);
  if (query?.postId) params.set("postId", String(query.postId));
  if (query?.page && query.page > 1) params.set("page", String(query.page));
  if (query?.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return request<UploadListResult>(`/api/admin/uploads${qs ? `?${qs}` : ""}`);
}

// Attach a batch of unassigned uploads to a post (after the post is created).
export function assignUploads(postId: number, keys: string[]): Promise<{ assigned: number }> {
  return request<{ assigned: number }>(
    "/api/admin/uploads/assign",
    jsonInit("POST", { postId, keys }),
  );
}

export function deleteUpload(key: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/admin/uploads/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}

export function replaceUpload(key: string, file: Blob): Promise<{ url: string }> {
  return request<{ url: string }>(`/api/admin/uploads/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
}

// Builds the public URL for an uploaded object (dev-proxied path or absolute).
export function fileUrl(key: string): string {
  return `${API_BASE_URL}/api/files/${encodeURIComponent(key)}`;
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
