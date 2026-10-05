import { describe, expect, test } from "vite-plus/test";
import { slugify } from "../src/slug.ts";

describe("slugify", () => {
  test("lowercases and hyphenates words", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("strips punctuation and collapses separators", () => {
    expect(slugify("  Foo: bar!! baz  ")).toBe("foo-bar-baz");
  });

  test("trims leading and trailing hyphens", () => {
    expect(slugify("--Hi--")).toBe("hi");
  });

  test("falls back to 'post' for text without ASCII letters or digits", () => {
    expect(slugify("你好世界")).toBe("post");
  });

  test("caps the slug at 80 characters", () => {
    expect(slugify("a".repeat(120))).toHaveLength(80);
  });
});
