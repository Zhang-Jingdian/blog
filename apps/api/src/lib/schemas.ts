import * as v from "valibot";

// JSON body: a positive integer.
const positiveInt = v.pipe(v.number(), v.integer(), v.minValue(1));

// URL/path params arrive as strings; coerce to a positive integer.
const intParam = v.pipe(
  v.string(),
  v.transform((s) => Number(s)),
  v.integer(),
  v.minValue(1),
);

const pageSizeParam = v.pipe(
  v.string(),
  v.transform((s) => Number(s)),
  v.integer(),
  v.minValue(1),
  v.maxValue(50),
);

const title = v.pipe(v.string(), v.minLength(1), v.maxLength(200));
const content = v.pipe(v.string(), v.minLength(1));
const slug = v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/));
const description = v.nullable(v.pipe(v.string(), v.maxLength(500)));
const coverUrl = v.nullable(v.pipe(v.string(), v.url()));
const categoryId = v.nullable(positiveInt);
const tagIds = v.pipe(v.array(positiveInt), v.maxLength(20));
const status = v.picklist(["draft", "published"]);

export const postBody = v.object({
  title,
  content,
  slug: v.optional(slug),
  description: v.optional(description),
  coverUrl: v.optional(coverUrl),
  categoryId: v.optional(categoryId),
  tagIds: v.optional(tagIds),
  status: v.optional(status),
});
export type PostBody = v.InferOutput<typeof postBody>;

export const patchStatusBody = v.object({ status });
export type PatchStatusBody = v.InferOutput<typeof patchStatusBody>;

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(50));

export const taxonomyBody = v.object({
  name,
  slug: v.optional(slug),
  description: v.optional(description),
});
export type TaxonomyBody = v.InferOutput<typeof taxonomyBody>;

export const publicListQuery = v.object({
  q: v.optional(v.pipe(v.string(), v.maxLength(50))),
  category: v.optional(v.string()),
  tag: v.optional(v.string()),
  page: v.optional(intParam),
  pageSize: v.optional(pageSizeParam),
});
export type PublicListQuery = v.InferOutput<typeof publicListQuery>;

export const adminListQuery = v.object({
  q: v.optional(v.pipe(v.string(), v.maxLength(50))),
  category: v.optional(v.string()),
  tag: v.optional(v.string()),
  status: v.optional(v.picklist(["all", "draft", "published"])),
  page: v.optional(intParam),
  pageSize: v.optional(pageSizeParam),
});
export type AdminListQuery = v.InferOutput<typeof adminListQuery>;

export const paginationQuery = v.object({
  page: v.optional(intParam),
  pageSize: v.optional(pageSizeParam),
});
export type PaginationQuery = v.InferOutput<typeof paginationQuery>;

export const idParams = v.object({ id: intParam });
export type IdParams = v.InferOutput<typeof idParams>;
