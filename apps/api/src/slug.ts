// Pure slug helpers (no DB / Worker imports) so they stay unit-testable.

const MAX_SLUG_LENGTH = 80;

/**
 * Turn arbitrary text into a URL-safe slug.
 * Non-ASCII titles (e.g. CJK) collapse to an empty string; callers should then
 * fall back to an explicit slug or accept the "post" placeholder.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || "post";
}
