import { defineHandler } from "void";
import { asc, count, eq, db } from "void/db";
import { postTag, tag } from "@schema";
import { AppError } from "../../../../src/lib/error.ts";
import { taxonomyBody } from "../../../../src/lib/schemas.ts";
import { slugify } from "../../../../src/lib/slug.ts";

function serialize(row: typeof tag.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// GET /api/admin/tags — list by name with postCount (drafts included).
export const GET = defineHandler(async () => {
  const rows = await db
    .select({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      postCount: count(postTag.postId),
    })
    .from(tag)
    .leftJoin(postTag, eq(postTag.tagId, tag.id))
    .groupBy(tag.id)
    .orderBy(asc(tag.name))
    .all();
  return rows.map((r) => ({ ...serialize(r), postCount: r.postCount }));
});

// POST /api/admin/tags
export const POST = defineHandler.withValidator({ body: taxonomyBody })(async (c, { body }) => {
  const slug = body.slug ?? slugify(body.name);
  if (!slug) throw new AppError(400, "Cannot generate a slug from the name");
  if (await db.select({ id: tag.id }).from(tag).where(eq(tag.slug, slug)).get()) {
    throw new AppError(409, "Slug already exists");
  }
  if (await db.select({ id: tag.id }).from(tag).where(eq(tag.name, body.name)).get()) {
    throw new AppError(409, "Name already exists");
  }
  const [row] = await db
    .insert(tag)
    .values({ name: body.name, slug, description: body.description ?? null })
    .returning();
  return c.json(serialize(row), 201);
});
