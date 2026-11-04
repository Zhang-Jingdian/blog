import { defineHandler } from "void";
import { inArray, db } from "void/db";
import { upload } from "@schema";
import { AppError } from "../../../../src/lib/error.ts";
import { getPostById } from "../../../../src/lib/post.ts";
import { uploadAssignBody } from "../../../../src/lib/schemas.ts";

// POST /api/admin/uploads/assign — attach a batch of unassigned uploads to a
// post. Used right after creating a post, for cover/inline images that were
// uploaded before the post had an id.
export const POST = defineHandler.withValidator({ body: uploadAssignBody })(async (
  _c,
  { body },
) => {
  if (!(await getPostById(body.postId))) throw new AppError(404, "Post not found");
  await db.update(upload).set({ postId: body.postId }).where(inArray(upload.key, body.keys));
  return { assigned: body.keys.length };
});
