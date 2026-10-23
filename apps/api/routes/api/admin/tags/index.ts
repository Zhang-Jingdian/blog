import { defineHandler } from "void";
import { asc, count, eq, db } from "void/db";
import { postTag, tag } from "@schema";
import { taxonomyBody } from "../../../../src/lib/schemas.ts";
import { ensureSlug } from "../../../../src/lib/slug.ts";
import { assertTaxonomyUnique, serializeTaxonomy } from "../../../../src/lib/taxonomy.ts";

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
  return rows.map((r) => ({ ...serializeTaxonomy(r), postCount: r.postCount }));
});

// POST /api/admin/tags
export const POST = defineHandler.withValidator({ body: taxonomyBody })(async (c, { body }) => {
  const slug = body.slug ?? ensureSlug(body.name);
  await assertTaxonomyUnique(tag, body.name, slug);
  const [row] = await db
    .insert(tag)
    .values({ name: body.name, slug, description: body.description ?? null })
    .returning();
  return c.json(serializeTaxonomy(row), 201);
});
