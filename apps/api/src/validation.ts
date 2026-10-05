// Request-body / query validation schemas, plugged into
// `defineHandler.withValidator` (Standard Schema). Keeping them here makes the
// rules reusable and unit-testable without a Worker.
import * as v from "valibot";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const title = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200));
const slug = v.pipe(
  v.string(),
  v.regex(slugPattern, "Slug must be lowercase words separated by '-'"),
);
const content = v.pipe(v.string(), v.minLength(1));
const status = v.picklist(["draft", "published"]);
const categoryId = v.pipe(v.number(), v.integer());
const description = v.nullable(v.string());
const coverUrl = v.nullable(v.string());

export const createPostSchema = v.object({
  title,
  slug: v.optional(slug),
  description: v.optional(description),
  content,
  coverUrl: v.optional(coverUrl),
  status: v.optional(status, "draft"),
  categoryId: v.optional(v.nullable(categoryId)),
});

// All fields optional, with NO defaults — omitting `status` on update must leave
// the post's status untouched (a default would silently revert published posts).
export const updatePostSchema = v.object({
  title: v.optional(title),
  slug: v.optional(slug),
  description: v.optional(description),
  content: v.optional(content),
  coverUrl: v.optional(coverUrl),
  status: v.optional(status),
  categoryId: v.optional(v.nullable(categoryId)),
});

// Query values arrive as strings; coerce to a bounded positive integer.
const queryInt = v.pipe(
  v.union([v.string(), v.number()]),
  v.transform((value) => Number(value)),
  v.number(),
  v.finite(),
  v.integer(),
);

const page = v.optional(v.pipe(queryInt, v.minValue(1)), 1);
const limit = v.optional(v.pipe(queryInt, v.minValue(1), v.maxValue(50)), 8);

export const listQuerySchema = v.object({ page, limit });

export const adminListQuerySchema = v.object({
  page,
  limit,
  status: v.optional(status),
});

export type CreatePostInput = v.InferOutput<typeof createPostSchema>;
export type UpdatePostInput = v.InferOutput<typeof updatePostSchema>;
export type ListQuery = v.InferOutput<typeof listQuerySchema>;
export type AdminListQuery = v.InferOutput<typeof adminListQuerySchema>;
