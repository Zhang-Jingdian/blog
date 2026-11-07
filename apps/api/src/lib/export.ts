// Helpers for the post export endpoint: bundle a post's markdown plus its media
// into a self-contained archive, rewriting image URLs to local `file/` paths.

// Matches the `/api/files/<key>` tail of an upload URL. Keys are generated as
// `file-<uuid>.<ext>` (lowercase hex + dots + dashes), so no URL-decoding is
// needed to recover the R2 object key.
const FILE_URL_RE = /\/api\/files\/([A-Za-z0-9._-]+)/g;

// Collect the unique upload keys referenced in a block of text (a post's
// markdown content or its cover URL).
export function extractFileKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const match of text.matchAll(FILE_URL_RE)) keys.add(match[1]);
  return [...keys];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Rewrite every `…/api/files/<key>` reference (absolute or relative) to the
// relative `file/<key>` path the files get inside the exported archive.
export function rewriteFileUrls(text: string, keys: Iterable<string>): string {
  let out = text;
  for (const key of keys) {
    const escaped = escapeRegExp(key);
    const re = new RegExp(
      `https?://[^\\s"'()<>]*?/api/files/${escaped}|/api/files/${escaped}`,
      "g",
    );
    out = out.replace(re, `file/${key}`);
  }
  return out;
}

// JSON string literals are valid YAML double-quoted scalars, so this doubles as
// a safe frontmatter serializer (escapes quotes, newlines, and control chars).
function yamlString(value: string): string {
  return JSON.stringify(value);
}

export interface ExportPost {
  title: string;
  description: string | null;
  content: string;
  publishedAt: Date | null;
}

export interface ExportMeta {
  categoryName?: string | null;
  tagNames: string[];
  coverKey?: string | null;
}

// Render the export markdown: a small frontmatter block (title/description/
// pubDate/category/tags, plus heroImage when the cover is a bundled file),
// followed by the post content with image URLs rewritten to `file/<key>`.
export function buildMarkdown(post: ExportPost, meta: ExportMeta, fileKeys: string[]): string {
  const lines = ["---"];
  lines.push(`title: ${yamlString(post.title)}`);
  if (post.description) lines.push(`description: ${yamlString(post.description)}`);
  if (post.publishedAt) {
    lines.push(`pubDate: ${yamlString(post.publishedAt.toISOString().slice(0, 10))}`);
  }
  if (meta.coverKey) lines.push(`heroImage: ${yamlString(`./file/${meta.coverKey}`)}`);
  if (meta.categoryName) lines.push(`category: ${yamlString(meta.categoryName)}`);
  if (meta.tagNames.length > 0) {
    lines.push("tags:");
    for (const name of meta.tagNames) lines.push(`  - ${yamlString(name)}`);
  }
  lines.push("---", "");
  lines.push(rewriteFileUrls(post.content, fileKeys));
  return `${lines.join("\n")}\n`;
}
