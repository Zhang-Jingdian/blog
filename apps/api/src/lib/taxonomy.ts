import { and, eq, ne, db } from "void/db";
import { type AnySQLiteTable } from "void/schema-d1";
import { category } from "@schema";
import { AppError } from "./error.ts";

// `category` and `tag` share an identical column shape, so `category`'s type is
// used as the stand-in after a one-time cast (Drizzle table types are nominal,
// but the SQL only depends on the shared column/table names).
type TaxonomyTable = typeof category;

type TaxonomyRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeTaxonomy(row: TaxonomyRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Reject a slug/name that already exists on another row (or any row when
// `excludeId` is omitted, i.e. on create).
export async function assertTaxonomyUnique(
  table: AnySQLiteTable,
  name: string,
  slug: string,
  excludeId?: number,
): Promise<void> {
  const t = table as unknown as TaxonomyTable;
  const notSelf = excludeId === undefined ? undefined : ne(t.id, excludeId);

  const slugWhere = notSelf ? and(eq(t.slug, slug), notSelf) : eq(t.slug, slug);
  if (await db.select({ id: t.id }).from(t).where(slugWhere).get()) {
    throw new AppError(409, "Slug already exists");
  }

  const nameWhere = notSelf ? and(eq(t.name, name), notSelf) : eq(t.name, name);
  if (await db.select({ id: t.id }).from(t).where(nameWhere).get()) {
    throw new AppError(409, "Name already exists");
  }
}
