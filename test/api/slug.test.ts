import { describe, expect, it } from "vite-plus/test";
import { isValidSlug, slugify } from "../../apps/api/src/lib/slug.ts";

describe("slugify", () => {
  it("lowercases and replaces non-slug characters with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("  A  B  ")).toBe("a-b");
  });

  it("collapses runs of hyphens", () => {
    expect(slugify("a--b")).toBe("a-b");
    expect(slugify("a / b")).toBe("a-b");
  });

  it("returns an empty string for names with no slug characters", () => {
    expect(slugify("纯中文")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase letters, digits and hyphens", () => {
    expect(isValidSlug("hello-world-2")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
  });

  it("rejects uppercase, underscores and empty strings", () => {
    expect(isValidSlug("Hello")).toBe(false);
    expect(isValidSlug("hello_world")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });
});
