import { defineHandler } from "void";
import { asc, count, eq, db } from "void/db";
import { category, post } from "@schema";
import { taxonomyBody } from "../../../../src/lib/schemas.ts";
import { ensureSlug } from "../../../../src/lib/slug.ts";
import { assertTaxonomyUnique, serializeTaxonomy } from "../../../../src/lib/taxonomy.ts";

// GET /api/admin/categories — list by name with postCount (drafts included).
export const GET = defineHandler(async () => {
  const rows = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      postCount: count(post.id),
    })
    .from(category)
    .leftJoin(post, eq(post.categoryId, category.id))
    .groupBy(category.id)
    .orderBy(asc(category.name))
    .all();
  return rows.map((r) => ({ ...serializeTaxonomy(r), postCount: r.postCount }));
});

// POST /api/admin/categories
export const POST = defineHandler.withValidator({ body: taxonomyBody })(async (c, { body }) => {
  const slug = body.slug ?? ensureSlug(body.name);
  await assertTaxonomyUnique(category, body.name, slug);
  const [row] = await db
    .insert(category)
    .values({ name: body.name, slug, description: body.description ?? null })
    .returning();
  return c.json(serializeTaxonomy(row), 201);
});
