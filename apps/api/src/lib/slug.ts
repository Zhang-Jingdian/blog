// Derive a slug from a human-readable name. Returns an empty string when the
// name contains no slug-compatible characters (e.g. a pure-Chinese title).
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A unique-enough token for names with no slug-compatible characters (e.g. a
// pure-Chinese title), so slug generation never produces an empty string.
export function fallbackSlug(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

// Derive a slug from text, falling back to a unique token instead of ever
// returning an empty string.
export function ensureSlug(name: string): string {
  return slugify(name) || fallbackSlug();
}
