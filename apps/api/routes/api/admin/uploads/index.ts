import { defineHandler } from "void";
import { storage } from "void/storage";
import { AppError } from "../../../../src/lib/error.ts";
import { paginationQuery } from "../../../../src/lib/schemas.ts";
import {
  IMAGE_EXT,
  MAX_SIZE,
  matchesImageMagic,
  paginateUploads,
  type UploadObject,
} from "../../../../src/lib/upload.ts";

// Upper bound on objects fetched for one list request (R2 caps a single call at
// 1000 and returns a cursor for the rest).
const MAX_LIST_OBJECTS = 5000;

// GET /api/admin/uploads — list uploaded objects, newest first.
export const GET = defineHandler.withValidator({ query: paginationQuery })(async (
  _c,
  { query },
) => {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

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

  return paginateUploads(objects, page, pageSize);
});

// POST /api/admin/uploads — store a cover image in R2 and return its URL.
export const POST = defineHandler(async (c) => {
  const raw = c.req.header("content-type") ?? "";
  const contentType = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = IMAGE_EXT[contentType];
  if (!ext) throw new AppError(415, "Unsupported image type");

  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) throw new AppError(400, "Empty file");
  if (bytes.byteLength > MAX_SIZE) throw new AppError(413, "Image too large");
  if (!matchesImageMagic(contentType, new Uint8Array(bytes))) {
    throw new AppError(415, "File content does not match its declared image type");
  }

  const key = `cover-${crypto.randomUUID()}.${ext}`;
  await storage.put(key, bytes, { httpMetadata: { contentType } });

  return { url: new URL(`/api/files/${key}`, c.req.url).toString() };
});
