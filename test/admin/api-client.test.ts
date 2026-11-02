import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  ApiError,
  deleteUpload,
  fileUrl,
  getPost,
  listPosts,
  listUploads,
  replaceUpload,
  uploadImage,
} from "../../apps/admin/src/api/client.ts";

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

describe("admin uploadImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs the file body with its content type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonEnvelope(200, { url: "http://localhost:5173/api/files/cover-1.png" }));
    vi.stubGlobal("fetch", fetchMock);

    const file = new Blob(["img"], { type: "image/png" });
    await expect(uploadImage(file)).resolves.toEqual({
      url: "http://localhost:5173/api/files/cover-1.png",
    });

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/admin/uploads");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("image/png");
    expect(init.body).toBe(file);
  });
});

describe("admin uploads library", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("listUploads builds query params and unwraps the list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonEnvelope(200, { items: [], page: 2, pageSize: 24, total: 0, totalPages: 0 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listUploads({ q: "cover", page: 2, pageSize: 24 });

    const url = fetchMock.mock.calls[0][0] as string;
    const parsed = new URL(url, "http://x");
    expect(parsed.pathname).toBe("/api/admin/uploads");
    expect(parsed.searchParams.get("q")).toBe("cover");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("pageSize")).toBe("24");
  });

  it("deleteUpload sends DELETE to the keyed path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonEnvelope(200, { deleted: true }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteUpload("cover-1.png");

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/admin/uploads/cover-1.png");
    expect(init.method).toBe("DELETE");
  });

  it("replaceUpload sends PUT with the file body and content type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonEnvelope(200, { url: "/api/files/cover-1.png" }));
    vi.stubGlobal("fetch", fetchMock);

    const file = new Blob(["img"], { type: "image/jpeg" });
    await replaceUpload("cover-1.png", file);

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/admin/uploads/cover-1.png");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("image/jpeg");
    expect(init.body).toBe(file);
  });

  it("fileUrl builds a dev-proxied path when API_BASE_URL is empty", () => {
    expect(fileUrl("cover-1.png")).toBe("/api/files/cover-1.png");
  });
});
