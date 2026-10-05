import { describe, expect, test } from "vite-plus/test";
import * as v from "valibot";
import { createPostSchema, listQuerySchema, updatePostSchema } from "../src/validation.ts";

describe("createPostSchema", () => {
  test("accepts a minimal post and defaults status to draft", () => {
    const result = v.parse(createPostSchema, { title: "Hi", content: "body" });
    expect(result.status).toBe("draft");
    expect(result.slug).toBeUndefined();
  });

  test("rejects a blank title", () => {
    expect(() => v.parse(createPostSchema, { title: "   ", content: "body" })).toThrow();
  });

  test("rejects a malformed slug", () => {
    expect(() =>
      v.parse(createPostSchema, { title: "Hi", content: "body", slug: "Not A Slug" }),
    ).toThrow();
  });
});

describe("updatePostSchema", () => {
  test("does not default status (a partial update must leave it untouched)", () => {
    expect(v.parse(updatePostSchema, {})).toEqual({});
  });
});

describe("listQuerySchema", () => {
  test("applies defaults", () => {
    expect(v.parse(listQuerySchema, {})).toEqual({ page: 1, limit: 8 });
  });

  test("coerces string query values", () => {
    expect(v.parse(listQuerySchema, { page: "3", limit: "20" })).toEqual({ page: 3, limit: 20 });
  });

  test("rejects a limit above the maximum", () => {
    expect(() => v.parse(listQuerySchema, { limit: "999" })).toThrow();
  });
});
