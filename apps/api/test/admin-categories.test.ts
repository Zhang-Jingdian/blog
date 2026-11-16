import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { createTestDb, type TestDatabase } from "./helpers/db.ts";
import { createApp, request, jsonInit } from "./helpers/app.ts";
import { createCategory, createPost } from "./helpers/seed.ts";

describe("admin categories", () => {
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

  describe("GET /api/admin/categories", () => {
    it("lists categories sorted by name with post counts (drafts included)", async () => {
      const zebra = await createCategory(db.db, { name: "Zebra", slug: "zebra" });
      const alpha = await createCategory(db.db, { name: "Alpha", slug: "alpha" });
      await createPost(db.db, {
        title: "Draft",
        slug: "draft",
        status: "draft",
        categoryId: alpha.id,
      });

      const res = await request(app, "/api/admin/categories");
      expect(res.status).toBe(200);
      expect(data(res).map((c: { name: string }) => c.name)).toEqual(["Alpha", "Zebra"]);
      expect(data(res).find((c: { id: number }) => c.id === alpha.id).postCount).toBe(1);
      expect(data(res).find((c: { id: number }) => c.id === zebra.id).postCount).toBe(0);
    });
  });

  describe("POST /api/admin/categories", () => {
    it("creates a category with a slug derived from the name", async () => {
      const res = await request(
        app,
        "/api/admin/categories",
        jsonInit("POST", { name: "Back End" }),
      );
      expect(res.status).toBe(201);
      expect(data(res)).toMatchObject({ name: "Back End", slug: "back-end" });
    });

    it("rejects a duplicate name or slug with 409", async () => {
      await createCategory(db.db, { name: "Existing", slug: "existing" });

      // Name collides but slug differs → "Name already exists".
      const dupName = await request(
        app,
        "/api/admin/categories",
        jsonInit("POST", { name: "Existing", slug: "unique" }),
      );
      expect(dupName.status).toBe(409);
      expect(dupName.body.message).toBe("Name already exists");

      // Slug collides but name differs → "Slug already exists".
      const dupSlug = await request(
        app,
        "/api/admin/categories",
        jsonInit("POST", { name: "Another", slug: "existing" }),
      );
      expect(dupSlug.status).toBe(409);
      expect(dupSlug.body.message).toBe("Slug already exists");
    });
  });

  describe("PUT /api/admin/categories/:id", () => {
    it("updates a category, keeping the slug when omitted", async () => {
      const cat = await createCategory(db.db, { name: "Old", slug: "old" });
      const res = await request(
        app,
        `/api/admin/categories/${cat.id}`,
        jsonInit("PUT", { name: "New" }),
      );
      expect(res.status).toBe(200);
      expect(data(res)).toMatchObject({ name: "New", slug: "old" });
    });

    it("rejects a name or slug used by another category", async () => {
      await createCategory(db.db, { name: "Taken", slug: "taken" });
      const cat = await createCategory(db.db, { name: "Me", slug: "me" });

      const dupName = await request(
        app,
        `/api/admin/categories/${cat.id}`,
        jsonInit("PUT", { name: "Taken" }),
      );
      expect(dupName.status).toBe(409);

      const dupSlug = await request(
        app,
        `/api/admin/categories/${cat.id}`,
        jsonInit("PUT", { name: "Me", slug: "taken" }),
      );
      expect(dupSlug.status).toBe(409);
    });

    it("returns 404 for a missing category", async () => {
      const res = await request(app, "/api/admin/categories/999", jsonInit("PUT", { name: "X" }));
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/admin/categories/:id", () => {
    it("uncategorizes its posts and reports how many", async () => {
      const cat = await createCategory(db.db, { name: "Cat", slug: "cat" });
      await createPost(db.db, { title: "One", slug: "one", categoryId: cat.id });
      await createPost(db.db, { title: "Two", slug: "two", categoryId: cat.id });

      const res = await request(app, `/api/admin/categories/${cat.id}`, { method: "DELETE" });
      expect(res.status).toBe(200);
      expect(data(res)).toEqual({ deleted: true, affectedPosts: 2 });

      // The posts survive but are uncategorized.
      const posts = await request(app, "/api/admin/posts");
      expect(posts.body.data.items.every((p: { category: unknown }) => p.category === null)).toBe(
        true,
      );
    });

    it("returns 404 for a missing category", async () => {
      const res = await request(app, "/api/admin/categories/999", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });
});
