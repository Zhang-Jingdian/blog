import { defineMiddleware } from "void";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Wrap every /api/* response in the { code, message, data } envelope.
// `code` mirrors the HTTP status; `message` is "ok" on success and the error
// text on failure. Native validation failures (`{ error, issues }`) are also
// converted here because they are not emitted in envelope form by Void.
// Thrown AppErrors are already envelopes: Void's onError calls their
// `getResponse()` and records the error on `c.error`, so those are left intact.
export default defineMiddleware(async (c, next) => {
  const path = c.req.path;
  if (!path.startsWith("/api/")) {
    await next();
    return;
  }

  await next();

  // AppError -> onError already produced the envelope; don't touch the body.
  if (c.error) return;

  const res = c.res;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return;

  // Reading the body is safe here: every branch below replaces `c.res` with a
  // fresh response, so the original is never passed through after being read.
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return;
  }

  if (body !== null && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if ("error" in obj && "issues" in obj) {
      c.res = jsonResponse(res.status, {
        code: res.status,
        message: String(obj.error),
        data: { issues: obj.issues },
      });
      return;
    }
  }

  c.res = jsonResponse(res.status, { code: res.status, message: "ok", data: body });
});
