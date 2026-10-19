export type PostStatus = "draft" | "published";

export type TaxonomyKind = "tag" | "category";

export interface PostListItem {
  id: number;
  title: string;
  slug: string;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string;
  category: { name: string; slug: string } | null;
}

export interface PostListResult {
  items: PostListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  content: string;
  coverUrl: string | null;
  status: PostStatus;
  categoryId: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tagIds: number[];
}

export interface Taxonomy {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  postCount?: number;
}

export interface PostInput {
  title: string;
  content: string;
  slug?: string;
  description?: string | null;
  coverUrl?: string | null;
  categoryId?: number | null;
  tagIds?: number[];
  status?: PostStatus;
}

export interface TaxonomyInput {
  name: string;
  slug?: string;
  description?: string | null;
}
