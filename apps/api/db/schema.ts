import { sqliteTable, text, integer, primaryKey, index, check } from "void/schema-d1";
import { sql } from "void/db";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

const timestamps = {
  createdAt: timestamp("createdAt")
    .notNull()
    .$defaultFn(() => new Date()),
  // `$onUpdate` stamps every UPDATE automatically (runtime-only in Drizzle, no
  // migration), so handlers no longer have to remember to set `updatedAt`.
  updatedAt: timestamp("updatedAt")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

export const category = sqliteTable("category", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  ...timestamps,
});

export const tag = sqliteTable("tag", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  ...timestamps,
});

export const post = sqliteTable(
  "post",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    content: text("content").notNull(),
    coverUrl: text("coverUrl"),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    categoryId: integer("categoryId").references(() => category.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("publishedAt"),
    ...timestamps,
  },
  (t) => [
    check("post_status_check", sql`${t.status} IN ('draft', 'published')`),
    check("post_publishedAt_required", sql`${t.status} = 'draft' OR ${t.publishedAt} IS NOT NULL`),
    index("post_status_publishedAt_idx").on(t.status, t.publishedAt),
    index("post_categoryId_idx").on(t.categoryId),
  ],
);

export const postTag = sqliteTable(
  "postTag",
  {
    postId: integer("postId")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    tagId: integer("tagId")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("postTag_tagId_idx").on(t.tagId)],
);

// Uploaded media files. `key` is the flat R2 object key; `postId` scopes a file
// to the post it was uploaded from (null = unassigned / global). R2 stays the
// byte store, this table is the metadata + per-post association.
export const upload = sqliteTable(
  "upload",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull().unique(),
    contentType: text("contentType").notNull(),
    size: integer("size").notNull(),
    postId: integer("postId").references(() => post.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("upload_postId_idx").on(t.postId)],
);
