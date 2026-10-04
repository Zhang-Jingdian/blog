// 博客数据库 schema（SQLite / D1 + Drizzle）。
// 与 apps/api/docs/db.md 一一对应，字段 / 约束 / 索引以 db.md 为准。
import { sql } from "void/db";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "void/schema-d1";

// 时间字段统一为 Unix 秒级时间戳（integer({ mode: "timestamp" })）。

// 1. users（Better Auth）
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// 2. sessions（Better Auth）
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

// 3. accounts（Better Auth）
export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    uniqueIndex("accounts_provider_account_idx").on(t.providerId, t.accountId),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

// 4. verifications（Better Auth）
export const verifications = sqliteTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// 5. posts
export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    content: text("content").notNull(),
    coverUrl: text("cover_url"),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    check("posts_status_check", sql`${t.status} IN ('draft', 'published')`),
    check(
      "posts_published_at_check",
      sql`(${t.status} = 'draft') OR (${t.publishedAt} IS NOT NULL)`,
    ),
    index("posts_status_published_at_idx").on(t.status, sql`${t.publishedAt} desc`),
    index("posts_category_id_idx").on(t.categoryId),
  ],
);

// 6. categories
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// 7. tags
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// 8. post_tags
export const postTags = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("post_tags_tag_id_idx").on(t.tagId)],
);

// 9. post_links（双链）
export const postLinks = sqliteTable(
  "post_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourcePostId: integer("source_post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    targetPostId: integer("target_post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
    targetText: text("target_text").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    uniqueIndex("post_links_source_target_text_idx").on(t.sourcePostId, t.targetText),
    check(
      "post_links_no_self_check",
      sql`(${t.targetPostId} IS NULL) OR (${t.sourcePostId} != ${t.targetPostId})`,
    ),
    index("post_links_target_post_id_idx").on(t.targetPostId),
  ],
);

// 10. settings
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
