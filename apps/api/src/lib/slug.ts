// Lowercase letters, digits and hyphens only.
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

// Derive a slug from a human-readable name. Returns an empty string when the
// name contains no slug-compatible characters (e.g. a pure-Chinese title).
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
