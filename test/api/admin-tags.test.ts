import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { createTestDb, type TestDatabase } from "./helpers/db.ts";
import { createApp, request, jsonInit } from "./helpers/app.ts";
import { createPost, createTag } from "./helpers/seed.ts";

describe("admin tags", () => {
  let db: TestDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createTestDb();
    app = createApp();
  });

  afterEach(() => db.close());

  function data(res: { body: any }): any {
    return res.body.data;
  }

  describe("GET /api/admin/tags", () => {
    it("lists tags sorted by name with post counts (drafts included)", async () => {
      const zebra = await createTag(db.db, { name: "Zebra", slug: "zebra" });
      const alpha = await createTag(db.db, { name: "Alpha", slug: "alpha" });
      await createPost(db.db, {
        title: "Draft",
        slug: "draft",
        status: "draft",
        tagIds: [alpha.id],
      });

      const res = await request(app, "/api/admin/tags");
      expect(res.status).toBe(200);
      expect(data(res).map((t: { name: string }) => t.name)).toEqual(["Alpha", "Zebra"]);
      expect(data(res).find((t: { id: number }) => t.id === alpha.id).postCount).toBe(1);
      expect(data(res).find((t: { id: number }) => t.id === zebra.id).postCount).toBe(0);
    });
  });

  describe("POST /api/admin/tags", () => {
    it("creates a tag with a slug derived from the name", async () => {
      const res = await request(app, "/api/admin/tags", jsonInit("POST", { name: "Back End" }));
      expect(res.status).toBe(201);
      expect(data(res)).toMatchObject({ name: "Back End", slug: "back-end" });
    });

    it("rejects a duplicate name or slug with 409", async () => {
      await createTag(db.db, { name: "Existing", slug: "existing" });

      // Name collides but slug differs → "Name already exists".
      const dupName = await request(
        app,
        "/api/admin/tags",
        jsonInit("POST", { name: "Existing", slug: "unique" }),
      );
      expect(dupName.status).toBe(409);
      expect(dupName.body.message).toBe("Name already exists");

      // Slug collides but name differs → "Slug already exists".
      const dupSlug = await request(
        app,
        "/api/admin/tags",
        jsonInit("POST", { name: "Another", slug: "existing" }),
      );
      expect(dupSlug.status).toBe(409);
      expect(dupSlug.body.message).toBe("Slug already exists");
    });

    it("rejects a name that cannot produce a slug", async () => {
      const res = await request(app, "/api/admin/tags", jsonInit("POST", { name: "中文" }));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Cannot generate a slug from the name");
    });
  });

  describe("PUT /api/admin/tags/:id", () => {
    it("updates a tag, keeping the slug when omitted", async () => {
      const tag = await createTag(db.db, { name: "Old", slug: "old" });
      const res = await request(app, `/api/admin/tags/${tag.id}`, jsonInit("PUT", { name: "New" }));
      expect(res.status).toBe(200);
      expect(data(res)).toMatchObject({ name: "New", slug: "old" });
    });

    it("rejects a name or slug used by another tag", async () => {
      await createTag(db.db, { name: "Taken", slug: "taken" });
      const tag = await createTag(db.db, { name: "Me", slug: "me" });

      const dupName = await request(
        app,
        `/api/admin/tags/${tag.id}`,
        jsonInit("PUT", { name: "Taken" }),
      );
      expect(dupName.status).toBe(409);

      const dupSlug = await request(
        app,
        `/api/admin/tags/${tag.id}`,
        jsonInit("PUT", { name: "Me", slug: "taken" }),
      );
      expect(dupSlug.status).toBe(409);
    });

    it("returns 404 for a missing tag", async () => {
      const res = await request(app, "/api/admin/tags/999", jsonInit("PUT", { name: "X" }));
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/admin/tags/:id", () => {
    it("deletes the tag and its post links", async () => {
      const tag = await createTag(db.db, { name: "Tag", slug: "tag" });
      const post = await createPost(db.db, { title: "Post", slug: "post", tagIds: [tag.id] });

      const res = await request(app, `/api/admin/tags/${tag.id}`, { method: "DELETE" });
      expect(res.status).toBe(200);
      expect(data(res)).toEqual({ deleted: true });

      // The post survives; only its link is removed.
      const postRes = await request(app, `/api/admin/posts/${post.id}`);
      expect(postRes.status).toBe(200);
      expect(data(postRes).tagIds).toEqual([]);
    });

    it("returns 404 for a missing tag", async () => {
      const res = await request(app, "/api/admin/tags/999", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });
});
