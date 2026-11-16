import { describe, expect, it } from "vite-plus/test";

import { withHeaders } from "../src/lib/http.ts";

describe("withHeaders", () => {
  it("keeps the original headers, status and body", async () => {
    const original = new Response(JSON.stringify({ code: 401 }), {
      status: 401,
      headers: { "content-type": "application/json", "x-keep": "yes" },
    });

    const merged = withHeaders(original, { "access-control-allow-origin": "https://admin.test" });

    expect(merged.status).toBe(401);
    expect(merged.headers.get("x-keep")).toBe("yes");
    expect(merged.headers.get("content-type")).toBe("application/json");
    expect(merged.headers.get("access-control-allow-origin")).toBe("https://admin.test");
    expect(await merged.json()).toEqual({ code: 401 });
  });

  it("lets the caller override an existing header", () => {
    const original = new Response(null, { headers: { "cache-control": "no-store" } });

    const merged = withHeaders(original, { "cache-control": "public, max-age=60" });

    expect(merged.headers.get("cache-control")).toBe("public, max-age=60");
  });
});
