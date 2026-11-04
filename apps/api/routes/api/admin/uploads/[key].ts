import { defineHandler } from "void";
import { eq, db } from "void/db";
import { storage } from "void/storage";
import { upload } from "@schema";
import { AppError } from "../../../../src/lib/error.ts";
import { parseUploadedImage } from "../../../../src/lib/upload.ts";

// DELETE /api/admin/uploads/:key — remove an uploaded object from R2 and its row.
export const DELETE = defineHandler(async (c) => {
  const key = c.req.param("key")!;
  if (!(await storage.head(key))) throw new AppError(404, "File not found");
  // Delete the metadata row first so the library can't briefly list a broken file.
  await db.delete(upload).where(eq(upload.key, key));
  await storage.delete(key);
  return { deleted: true };
});

// PUT /api/admin/uploads/:key — replace an existing object's content while
// keeping the same key (and URL), so references in posts stay intact.
export const PUT = defineHandler(async (c) => {
  const key = c.req.param("key")!;
  if (!(await storage.head(key))) throw new AppError(404, "File not found");

  const bytes = await c.req.arrayBuffer();
  const { contentType } = parseUploadedImage(c.req.header("content-type") ?? "", bytes);

  await storage.put(key, bytes, { httpMetadata: { contentType } });
  await db.update(upload).set({ contentType, size: bytes.byteLength }).where(eq(upload.key, key));
  return { url: new URL(`/api/files/${key}`, c.req.url).toString() };
});
