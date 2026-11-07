import { defineHandler } from "void";
import { asc, eq, inArray, db } from "void/db";
import { storage } from "void/storage";
import { category, tag, upload } from "@schema";
import { strToU8, zipSync } from "fflate";
import { buildMarkdown, extractFileKeys } from "../../../../../src/lib/export.ts";
import { AppError } from "../../../../../src/lib/error.ts";
import { idParams } from "../../../../../src/lib/schemas.ts";
import { getPostById, tagIdsForPost } from "../../../../../src/lib/post.ts";

// GET /api/admin/posts/:id/export — package a post as a self-contained zip:
// `<slug>.md` plus a `file/` directory of its media, with image URLs rewritten
// to relative `file/<key>` paths. Returns raw bytes (not the JSON envelope).
export const GET = defineHandler.withValidator({ params: idParams })(async (
  _c,
  { params: { id } },
) => {
  const row = await getPostById(id);
  if (!row) throw new AppError(404, "Post not found");

  // Category + tag names for the frontmatter block.
  const categoryRow = row.categoryId
    ? await db
        .select({ name: category.name })
        .from(category)
        .where(eq(category.id, row.categoryId))
        .get()
    : undefined;
  const tagIds = await tagIdsForPost(id);
  const tagRows = tagIds.length
    ? await db
        .select({ name: tag.name })
        .from(tag)
        .where(inArray(tag.id, tagIds))
        .orderBy(asc(tag.name))
        .all()
    : [];

  const coverKey = row.coverUrl ? (extractFileKeys(row.coverUrl)[0] ?? null) : null;

  // Media to bundle: everything assigned to this post, plus any key the content
  // or cover still references (covers uploads assigned only after save).
  const assigned = await db.select().from(upload).where(eq(upload.postId, id)).all();
  const keys = new Set(assigned.map((u) => u.key));
  for (const key of extractFileKeys(row.content)) keys.add(key);
  if (coverKey) keys.add(coverKey);

  // Read each object's bytes from R2. Missing objects are skipped rather than
  // failing the whole export, leaving their reference dangling but unbroken.
  const files: Record<string, Uint8Array> = {};
  for (const key of keys) {
    const object = await storage.get(key);
    if (!object) continue;
    files[`file/${key}`] = new Uint8Array(await object.arrayBuffer());
  }

  const markdown = buildMarkdown(
    {
      title: row.title,
      description: row.description,
      content: row.content,
      publishedAt: row.publishedAt,
    },
    { categoryName: categoryRow?.name, tagNames: tagRows.map((t) => t.name), coverKey },
    [...keys],
  );

  const zipped = zipSync({ [`${row.slug}.md`]: strToU8(markdown), ...files });

  return new Response(zipped, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${row.slug}.zip"`,
    },
  });
});
