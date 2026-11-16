import { describe, expect, it } from "vite-plus/test";
import { ensureSlug, fallbackSlug, slugify } from "../src/lib/slug.ts";

describe("slugify", () => {
  it("lowercases and replaces non-slug characters with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("  A  B  ")).toBe("a-b");
  });

  it("collapses runs of hyphens", () => {
    expect(slugify("a--b")).toBe("a-b");
    expect(slugify("a / b")).toBe("a-b");
  });

  it("keeps letters and digits of non-Latin scripts", () => {
    expect(slugify("我的第一篇文章")).toBe("我的第一篇文章");
    expect(slugify("Hello 世界")).toBe("hello-世界");
    expect(slugify("第 2 章")).toBe("第-2-章");
  });

  it("replaces punctuation and symbols with a single hyphen", () => {
    expect(slugify("《中文》标题！")).toBe("中文-标题");
    expect(slugify("a.b,c")).toBe("a-b-c");
  });

  it("folds full-width characters to their ASCII form", () => {
    expect(slugify("ＡＢＣ")).toBe("abc");
    expect(slugify("第１章")).toBe("第1章");
  });

  it("returns an empty string when there are no letters or digits", () => {
    expect(slugify("🎉🎉")).toBe("");
    expect(slugify("---")).toBe("");
  });
});

describe("ensureSlug", () => {
  it("uses the slugified name when it has slug characters", () => {
    expect(ensureSlug("Hello World")).toBe("hello-world");
  });

  it("keeps a Chinese name as-is", () => {
    expect(ensureSlug("我的第一篇文章")).toBe("我的第一篇文章");
  });

  it("falls back to a unique token when there are no slug characters", () => {
    const slug = ensureSlug("🎉");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug.length).toBeGreaterThan(0);
    expect(ensureSlug("🎉")).not.toBe(slug);
  });
});

describe("fallbackSlug", () => {
  it("is a non-empty slug-compatible token", () => {
    expect(fallbackSlug()).toMatch(/^[a-z0-9-]+$/);
  });
});
