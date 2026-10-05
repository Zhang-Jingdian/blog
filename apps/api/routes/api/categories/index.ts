import { defineHandler } from "void";
import { asc, db } from "void/db";
import { categories } from "@schema";

// GET /api/categories — every category, for the site and the admin form.
export const GET = defineHandler(async () => {
  const items = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
    })
    .from(categories)
    .orderBy(asc(categories.name));

  return { items };
});
