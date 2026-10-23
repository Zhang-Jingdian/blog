import { describe, expect, it } from "vite-plus/test";
import { ensureSlug, fallbackSlug, slugify } from "../../apps/api/src/lib/slug.ts";

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

describe("ensureSlug", () => {
  it("uses the slugified name when it has slug characters", () => {
    expect(ensureSlug("Hello World")).toBe("hello-world");
  });

  it("falls back to a unique token for names with no slug characters", () => {
    const slug = ensureSlug("纯中文");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug.length).toBeGreaterThan(0);
    expect(ensureSlug("纯中文")).not.toBe(slug);
  });
});

describe("fallbackSlug", () => {
  it("is a non-empty slug-compatible token", () => {
    expect(fallbackSlug()).toMatch(/^[a-z0-9-]+$/);
  });
});
