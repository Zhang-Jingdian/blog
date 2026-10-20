import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiError, getPost, listPosts, uploadCover } from "../../apps/admin/src/api/client.ts";

function jsonEnvelope<T>(code: number, data: T, status = 200): Response {
  return new Response(JSON.stringify({ code, message: "ok", data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("admin listPosts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds query params for the admin list endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonEnvelope(200, { items: [], page: 2, pageSize: 5, total: 0, totalPages: 0 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listPosts({ status: "published", q: "hi", page: 2, pageSize: 5 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/admin/posts?");
    const parsed = new URL(url, "http://x");
    expect(parsed.searchParams.get("status")).toBe("published");
    expect(parsed.searchParams.get("q")).toBe("hi");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("pageSize")).toBe("5");
  });

  it("omits status all and page 1", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonEnvelope(200, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listPosts({ status: "all", page: 1 });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/posts");
  });
});

describe("admin request envelope", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("unwraps data on success", async () => {
    const post = { id: 1, slug: "a", title: "A" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonEnvelope(200, post)));

    await expect(getPost(1)).resolves.toEqual(post);
  });

  it("throws ApiError with issues on a non-2xx response", async () => {
    const issues = [{ field: "title", message: "required" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 422, message: "Validation failed", data: issues }), {
          status: 422,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const err = await getPost(1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe("Validation failed");
    expect((err as ApiError).issues).toEqual(issues);
  });
});

describe("admin uploadCover", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs the file body with its content type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonEnvelope(200, { url: "http://localhost:5173/api/files/cover-1.png" }));
    vi.stubGlobal("fetch", fetchMock);

    const file = new Blob(["img"], { type: "image/png" });
    await expect(uploadCover(file)).resolves.toEqual({
      url: "http://localhost:5173/api/files/cover-1.png",
    });

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/admin/uploads");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("image/png");
    expect(init.body).toBe(file);
  });
});
