import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { createTestDb, type TestDatabase } from "./helpers/db.ts";
import { createApp, request, jsonInit, type JsonResponse } from "./helpers/app.ts";
import { createCategory, createPost, createTag } from "./helpers/seed.ts";

describe("admin posts", () => {
  let db: TestDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createTestDb();
    app = createApp();
  });

  afterEach(() => db.close());

  function data(res: JsonResponse): any {
    return res.body.data;
  }

  describe("GET /api/admin/posts", () => {
    it("lists drafts and published posts ordered by updatedAt desc", async () => {
      const a = await createPost(db.db, { title: "Draft", slug: "draft", status: "draft" });
      const b = await createPost(db.db, { title: "Live", slug: "live", status: "published" });

      const res = await request(app, "/api/admin/posts");
      expect(res.status).toBe(200);
      expect(data(res).total).toBe(2);
      expect(data(res).items.map((i: { slug: string }) => i.slug)).toEqual([b.slug, a.slug]);
    });

    it("filters by status, including the default all", async () => {
      await createPost(db.db, { title: "Draft", slug: "draft", status: "draft" });
      await createPost(db.db, { title: "Live", slug: "live", status: "published" });

      const drafts = await request(app, "/api/admin/posts?status=draft");
      expect(data(drafts).total).toBe(1);
      expect(data(drafts).items[0].slug).toBe("draft");

      const published = await request(app, "/api/admin/posts?status=published");
      expect(data(published).total).toBe(1);
      expect(data(published).items[0].slug).toBe("live");
    });

    it("filters by category, including category=none", async () => {
      const cat = await createCategory(db.db, { name: "Tech", slug: "tech" });
      await createPost(db.db, { title: "In cat", slug: "in-cat", categoryId: cat.id });
      await createPost(db.db, { title: "No cat", slug: "no-cat" });

      const inCat = await request(app, "/api/admin/posts?category=tech");
      expect(data(inCat).total).toBe(1);
      expect(data(inCat).items[0].slug).toBe("in-cat");

      const none = await request(app, "/api/admin/posts?category=none");
      expect(data(none).total).toBe(1);
      expect(data(none).items[0].slug).toBe("no-cat");
    });
  });

  describe("POST /api/admin/posts", () => {
    it("creates a draft with a slug derived from the title", async () => {
      const res = await request(
        app,
        "/api/admin/posts",
        jsonInit("POST", { title: "My First Post", content: "hello" }),
      );
      expect(res.status).toBe(201);
      expect(data(res)).toMatchObject({
        title: "My First Post",
        slug: "my-first-post",
        status: "draft",
        publishedAt: null,
        tagIds: [],
      });
    });

    it("sets publishedAt when creating a published post", async () => {
      const res = await request(
        app,
        "/api/admin/posts",
        jsonInit("POST", { title: "Live", content: "hello", status: "published" }),
      );
      expect(res.status).toBe(201);
      expect(data(res).status).toBe("published");
      expect(data(res).publishedAt).not.toBeNull();
    });

    it("rejects a duplicate slug with 409", async () => {
      await createPost(db.db, { title: "Existing", slug: "existing" });
      const res = await request(
        app,
        "/api/admin/posts",
        jsonInit("POST", { title: "Another", slug: "existing", content: "x" }),
      );
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Slug already exists");
    });

    it("derives a fallback slug for a title with no slug characters", async () => {
      const res = await request(
        app,
        "/api/admin/posts",
        jsonInit("POST", { title: "纯中文标题", content: "x" }),
      );
      expect(res.status).toBe(201);
      expect(res.body.data.slug).toMatch(/^[a-z0-9-]+$/);
    });

    it("rejects an unknown category or tag", async () => {
      const badCategory = await request(
        app,
        "/api/admin/posts",
        jsonInit("POST", { title: "Post", content: "x", categoryId: 999 }),
      );
      expect(badCategory.status).toBe(400);
      expect(badCategory.body.message).toBe("Category not found");

      const badTag = await request(
        app,
        "/api/admin/posts",
        jsonInit("POST", { title: "Post", content: "x", tagIds: [999] }),
      );
      expect(badTag.status).toBe(400);
      expect(badTag.body.message).toBe("Tag not found");
    });

    it("returns a validation envelope for an invalid body", async () => {
      const res = await request(app, "/api/admin/posts", jsonInit("POST", { content: "no title" }));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.data).toHaveProperty("issues");
    });
  });

  describe("GET /api/admin/posts/:id", () => {
    it("returns the post with tag ids sorted ascending", async () => {
      const tagB = await createTag(db.db, { name: "B", slug: "b" });
      const tagA = await createTag(db.db, { name: "A", slug: "a" });
      // Seed links in reverse id order; the route returns them sorted by id.
      const post = await createPost(db.db, {
        title: "Post",
        slug: "post",
        tagIds: [tagA.id, tagB.id],
      });

      const res = await request(app, `/api/admin/posts/${post.id}`);
      expect(res.status).toBe(200);
      expect(data(res).tagIds).toEqual([tagB.id, tagA.id]);
    });

    it("returns 404 for a missing post", async () => {
      const res = await request(app, "/api/admin/posts/999");
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Post not found");
    });
  });

  describe("PUT /api/admin/posts/:id", () => {
    it("replaces the post and its tags", async () => {
      const tag1 = await createTag(db.db, { name: "One", slug: "one" });
      const tag2 = await createTag(db.db, { name: "Two", slug: "two" });
      const post = await createPost(db.db, { title: "Old", slug: "old", tagIds: [tag1.id] });

      const res = await request(
        app,
        `/api/admin/posts/${post.id}`,
        jsonInit("PUT", { title: "New", content: "new body", tagIds: [tag2.id] }),
      );
      expect(res.status).toBe(200);
      expect(data(res)).toMatchObject({ title: "New", slug: "old", tagIds: [tag2.id] });
    });

    it("rejects a slug already used by another post", async () => {
      await createPost(db.db, { title: "Other", slug: "other" });
      const post = await createPost(db.db, { title: "Me", slug: "me" });

      const res = await request(
        app,
        `/api/admin/posts/${post.id}`,
        jsonInit("PUT", { title: "Me", slug: "other", content: "x" }),
      );
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Slug already exists");
    });

    it("keeps publishedAt pinned across publish/draft cycles", async () => {
      const post = await createPost(db.db, {
        title: "Post",
        slug: "post",
        status: "published",
        publishedAt: new Date("2026-05-01T00:00:00.000Z"),
      });
      // Draft it.
      const draftRes = await request(
        app,
        `/api/admin/posts/${post.id}`,
        jsonInit("PUT", { title: "Post", content: "x", status: "draft" }),
      );
      expect(data(draftRes).publishedAt).toBe("2026-05-01T00:00:00.000Z");

      // Re-publish it; publishedAt must not move.
      const publishRes = await request(
        app,
        `/api/admin/posts/${post.id}`,
        jsonInit("PUT", { title: "Post", content: "x", status: "published" }),
      );
      expect(data(publishRes).publishedAt).toBe("2026-05-01T00:00:00.000Z");
    });

    it("returns 404 for a missing post", async () => {
      const res = await request(
        app,
        "/api/admin/posts/999",
        jsonInit("PUT", { title: "x", content: "x" }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/admin/posts/:id/status", () => {
    it("flips draft to published and pins publishedAt", async () => {
      const post = await createPost(db.db, { title: "Post", slug: "post", status: "draft" });
      const res = await request(
        app,
        `/api/admin/posts/${post.id}/status`,
        jsonInit("PATCH", { status: "published" }),
      );
      expect(res.status).toBe(200);
      expect(data(res).status).toBe("published");
      expect(data(res).publishedAt).not.toBeNull();
    });

    it("returns 404 for a missing post", async () => {
      const res = await request(
        app,
        "/api/admin/posts/999/status",
        jsonInit("PATCH", { status: "published" }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/admin/posts/:id", () => {
    it("deletes the post and its tag links", async () => {
      const tag = await createTag(db.db, { name: "Tag", slug: "tag" });
      const post = await createPost(db.db, { title: "Post", slug: "post", tagIds: [tag.id] });

      const res = await request(app, `/api/admin/posts/${post.id}`, { method: "DELETE" });
      expect(res.status).toBe(200);
      expect(data(res)).toEqual({ deleted: true });

      const after = await request(app, `/api/admin/posts/${post.id}`);
      expect(after.status).toBe(404);
    });

    it("returns 404 for a missing post", async () => {
      const res = await request(app, "/api/admin/posts/999", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });
});
