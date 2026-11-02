import { defineHandler } from "void";
import { storage } from "void/storage";
import { uploadListQuery } from "../../../../src/lib/schemas.ts";
import {
  paginateUploads,
  parseUploadedImage,
  type UploadObject,
} from "../../../../src/lib/upload.ts";

// Upper bound on objects fetched for one list request (R2 caps a single call at
// 1000 and returns a cursor for the rest).
const MAX_LIST_OBJECTS = 5000;

// GET /api/admin/uploads — list uploaded objects, newest first, optionally
// filtered by a case-insensitive substring of the key.
export const GET = defineHandler.withValidator({ query: uploadListQuery })(async (
  _c,
  { query },
) => {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const q = query.q?.trim().toLowerCase();

  const objects: UploadObject[] = [];
  let cursor: string | undefined;
  do {
    const res = await storage.list({ limit: 1000, cursor });
    for (const o of res.objects) {
      objects.push({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded,
        contentType: o.httpMetadata?.contentType ?? null,
      });
    }
    cursor = res.truncated ? res.cursor : undefined;
  } while (cursor && objects.length < MAX_LIST_OBJECTS);

  const filtered = q ? objects.filter((o) => o.key.toLowerCase().includes(q)) : objects;
  return paginateUploads(filtered, page, pageSize);
});

// POST /api/admin/uploads — store an image (cover or inline) in R2 and return its URL.
export const POST = defineHandler(async (c) => {
  const bytes = await c.req.arrayBuffer();
  const { contentType, ext } = parseUploadedImage(c.req.header("content-type") ?? "", bytes);

  const key = `cover-${crypto.randomUUID()}.${ext}`;
  await storage.put(key, bytes, { httpMetadata: { contentType } });

  return { url: new URL(`/api/files/${key}`, c.req.url).toString() };
});
