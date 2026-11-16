// Derive a slug from a human-readable name. Letters and digits of any script are
// kept, so a Chinese title yields a Chinese slug (`我的第一篇文章`) and the URL
// reads as the title. Every run of other characters (spaces, punctuation,
// symbols, emoji) collapses into a single hyphen.
// NFKC first, so full-width input folds to its ASCII form (`ＡＢ` → `ab`).
export function slugify(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// A unique-enough token for names with no letters or digits at all (e.g. a title
// that is only emoji), so slug generation never produces an empty string.
export function fallbackSlug(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

// Derive a slug from text, falling back to a unique token instead of ever
// returning an empty string.
export function ensureSlug(name: string): string {
  return slugify(name) || fallbackSlug();
}
