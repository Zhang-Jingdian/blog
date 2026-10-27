import { defineHandler } from "void";
import { storage } from "void/storage";
import { AppError } from "../../../../src/lib/error.ts";

// DELETE /api/admin/uploads/:key — remove an uploaded object from R2.
export const DELETE = defineHandler(async (c) => {
  const key = c.req.param("key")!;
  if (!(await storage.head(key))) throw new AppError(404, "File not found");
  await storage.delete(key);
  return { deleted: true };
});
