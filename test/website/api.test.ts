import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  getPost,
  listAllPosts,
  listPosts,
  renderMarkdown,
} from "../../apps/website/src/lib/api.ts";

const BASE = "";

function jsonEnvelope<T>(code: number, data: T, status = 200): Response {
  return new Response(JSON.stringify({ code, message: "ok", data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("website listPosts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds query params and hits /api/posts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonEnvelope(200, { items: [], page: 2, pageSize: 5, total: 0, totalPages: 0 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listPosts({ q: "hello", category: "tech", tag: "rust", page: 2, pageSize: 5 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(`${BASE}/api/posts?`);
    const parsed = new URL(url, "http://x");
    expect(parsed.searchParams.get("q")).toBe("hello");
    expect(parsed.searchParams.get("category")).toBe("tech");
    expect(parsed.searchParams.get("tag")).toBe("rust");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("pageSize")).toBe("5");
  });

  it("omits empty params", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonEnvelope(200, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listPosts();

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/posts`);
  });
});

describe("website getPost", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns null on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(getPost("missing")).resolves.toBeNull();
  });

  it("throws on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(getPost("boom")).rejects.toThrow("500");
  });

  it("unwraps the envelope", async () => {
    const post = {
      id: 1,
      slug: "hello",
      title: "Hello",
      coverUrl: null,
      publishedAt: "2026-01-01T00:00:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonEnvelope(200, post)));

    await expect(getPost("hello")).resolves.toEqual(post);
  });
});

describe("website listAllPosts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("walks pagination until totalPages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonEnvelope(200, {
          items: [{ id: 1, slug: "a" }],
          page: 1,
          pageSize: 1,
          total: 3,
          totalPages: 3,
        }),
      )
      .mockResolvedValueOnce(
        jsonEnvelope(200, {
          items: [{ id: 2, slug: "b" }],
          page: 2,
          pageSize: 1,
          total: 3,
          totalPages: 3,
        }),
      )
      .mockResolvedValueOnce(
        jsonEnvelope(200, {
          items: [{ id: 3, slug: "c" }],
          page: 3,
          pageSize: 1,
          total: 3,
          totalPages: 3,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const items = await listAllPosts();

    expect(items.map((i) => i.slug)).toEqual(["a", "b", "c"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("website renderMarkdown", () => {
  it("converts markdown to HTML", () => {
    expect(renderMarkdown("# Hello")).toContain("<h1");
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });
});
