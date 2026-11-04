import { defineHandler } from "void";
import { and, count, desc, eq, sql, db } from "void/db";
import { storage } from "void/storage";
import { upload } from "@schema";
import { uploadListQuery, uploadPostQuery } from "../../../../src/lib/schemas.ts";
import { parseUploadedImage, toUploadItem } from "../../../../src/lib/upload.ts";

type Condition = ReturnType<typeof eq>;

// GET /api/admin/uploads — list uploads newest-first. `postId` scopes to a single
// post (the embedded editor library); without it the global library lists all.
export const GET = defineHandler.withValidator({ query: uploadListQuery })(async (
  _c,
  { query },
) => {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const q = query.q?.trim().toLowerCase();

  const conds: Condition[] = [];
  if (query.postId !== undefined) conds.push(eq(upload.postId, query.postId));
  if (q) conds.push(sql`(instr(lower(${upload.key}), lower(${q})) > 0)`);
  const where = conds.length > 0 ? and(...conds) : undefined;

  const countBase = db.select({ c: count() }).from(upload);
  const total = (await (where ? countBase.where(where) : countBase).get())?.c ?? 0;

  const select = db.select().from(upload);
  const rows = await (where ? select.where(where) : select)
    .orderBy(desc(upload.createdAt), desc(upload.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  return {
    items: rows.map(toUploadItem),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
});

// POST /api/admin/uploads?postId=<id> — store an image in R2 and record its
// metadata (and optional post association) in D1. Returns the key so the client
// can bulk-assign unassigned files to a post after it is created.
export const POST = defineHandler.withValidator({ query: uploadPostQuery })(async (
  c,
  { query },
) => {
  const bytes = await c.req.arrayBuffer();
  const { contentType, ext } = parseUploadedImage(c.req.header("content-type") ?? "", bytes);

  const key = `file-${crypto.randomUUID()}.${ext}`;
  await storage.put(key, bytes, { httpMetadata: { contentType } });
  await db.insert(upload).values({
    key,
    contentType,
    size: bytes.byteLength,
    postId: query.postId ?? null,
  });

  return { url: new URL(`/api/files/${key}`, c.req.url).toString(), key };
});
