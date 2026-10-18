import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { createTestDb, type TestDatabase } from "./helpers/db.ts";
import { createApp, request, type JsonResponse } from "./helpers/app.ts";
import { createCategory, createPost, createTag } from "./helpers/seed.ts";

describe("GET /api/blogs", () => {
  let db: TestDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createTestDb();
    app = createApp();
  });

  afterEach(() => db.close());

  async function list(path = "/api/blogs"): Promise<JsonResponse> {
    return request(app, path);
  }

  it("returns only published posts, newest first", async () => {
    await createPost(db.db, {
      title: "Older",
      slug: "older",
      status: "published",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await createPost(db.db, {
      title: "Newer",
      slug: "newer",
      status: "published",
      publishedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    await createPost(db.db, { title: "Draft", slug: "draft", status: "draft" });

    const res = await list();
    expect(res.status).toBe(200);
    const data = res.body.data as { items: { slug: string }[]; total: number };
    expect(data.total).toBe(2);
    expect(data.items.map((i) => i.slug)).toEqual(["newer", "older"]);
    // No content leaked for the public list.
    expect(data.items[0]).not.toHaveProperty("content");
  });

  it("paginates with page, pageSize, total and totalPages", async () => {
    for (let i = 0; i < 5; i += 1) {
      await createPost(db.db, {
        title: `Post ${i}`,
        slug: `post-${i}`,
        status: "published",
        publishedAt: new Date(`2026-01-0${i + 1}T00:00:00.000Z`),
      });
    }

    const res = await list("/api/blogs?page=2&pageSize=2");
    const data = res.body.data as {
      items: { slug: string }[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(2);
    expect(data.total).toBe(5);
    expect(data.totalPages).toBe(3);
    // Newest first: post-4, post-3 on page 1; post-2, post-1 on page 2.
    expect(data.items.map((i) => i.slug)).toEqual(["post-2", "post-1"]);
  });

  it("searches title and description case-insensitively", async () => {
    await createPost(db.db, {
      title: "Hello World",
      slug: "hello-world",
      description: "A friendly post",
      status: "published",
    });
    await createPost(db.db, {
      title: "Other",
      slug: "other",
      description: "About TYPEscript",
      status: "published",
    });

    const byTitle = await list("/api/blogs?q=hello");
    expect((byTitle.body.data as { total: number }).total).toBe(1);

    const byDescription = await list("/api/blogs?q=typescript");
    expect((byDescription.body.data as { total: number }).total).toBe(1);
  });

  it("filters by category and tag", async () => {
    const cat = await createCategory(db.db, { name: "Tech", slug: "tech" });
    const tag = await createTag(db.db, { name: "Rust", slug: "rust" });
    await createPost(db.db, {
      title: "Rust Post",
      slug: "rust-post",
      status: "published",
      categoryId: cat.id,
      tagIds: [tag.id],
    });
    await createPost(db.db, { title: "Uncategorized", slug: "uncategorized", status: "published" });

    const byCategory = await list("/api/blogs?category=tech");
    expect((byCategory.body.data as { total: number }).total).toBe(1);

    const byTag = await list("/api/blogs?tag=rust");
    expect((byTag.body.data as { total: number }).total).toBe(1);
  });
});

describe("GET /api/blogs/:slug", () => {
  let db: TestDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createTestDb();
    app = createApp();
  });

  afterEach(() => db.close());

  it("returns a published post with its category and tags sorted by name", async () => {
    const cat = await createCategory(db.db, { name: "Tech", slug: "tech" });
    const tagZ = await createTag(db.db, { name: "Zebra", slug: "zebra" });
    const tagA = await createTag(db.db, { name: "Alpha", slug: "alpha" });
    await createPost(db.db, {
      title: "Hello",
      slug: "hello",
      description: "desc",
      content: "body",
      coverUrl: "https://example.com/a.png",
      status: "published",
      categoryId: cat.id,
      tagIds: [tagZ.id, tagA.id],
      publishedAt: new Date("2026-03-01T12:00:00.000Z"),
    });

    const res = await request(app, "/api/blogs/hello");
    expect(res.status).toBe(200);
    const data = res.body.data as {
      slug: string;
      publishedAt: string;
      category: { name: string; slug: string } | null;
      tags: { name: string }[];
    };
    expect(data.slug).toBe("hello");
    expect(data.publishedAt).toBe("2026-03-01T12:00:00.000Z");
    expect(data.category).toEqual({ name: "Tech", slug: "tech" });
    expect(data.tags.map((t) => t.name)).toEqual(["Alpha", "Zebra"]);
  });

  it("returns category null when the post has none", async () => {
    await createPost(db.db, { title: "Lonely", slug: "lonely", status: "published" });
    const res = await request(app, "/api/blogs/lonely");
    expect((res.body.data as { category: unknown }).category).toBeNull();
  });

  it("does not expose draft posts", async () => {
    await createPost(db.db, { title: "Draft", slug: "draft", status: "draft" });
    const res = await request(app, "/api/blogs/draft");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 404, message: "Post not found", data: null });
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await request(app, "/api/blogs/missing");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 404, message: "Post not found", data: null });
  });
});
