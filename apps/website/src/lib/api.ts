import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import { createHighlighter, type BundledLanguage, type Highlighter } from "shiki";

// Fetch the posts API. Under SSG this runs at build time, so each page is
// generated from a snapshot of the API. Dev defaults to the local API
// (http://localhost:5173); production sets VITE_API_BASE_URL via CI.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5173";

export interface PostListItem {
  id: number;
  title: string;
  slug: string;
  coverUrl: string | null;
  publishedAt: string;
}

export interface Post extends PostListItem {
  description: string | null;
  content: string;
  updatedAt: string;
  category: { name: string; slug: string } | null;
  tags: { name: string; slug: string }[];
}

export interface PostListResult {
  items: PostListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API request failed: GET ${path} → ${res.status}`);
  }
  const body = (await res.json()) as Envelope<T>;
  if (body.code !== res.status) {
    throw new Error(
      `API envelope mismatch: GET ${path} → HTTP ${res.status} but code ${body.code}`,
    );
  }
  return body.data;
}

export interface PostListParams {
  q?: string;
  category?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export async function listPosts(params: PostListParams = {}): Promise<PostListResult> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.tag) search.set("tag", params.tag);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return get<PostListResult>(`/api/posts${qs ? `?${qs}` : ""}`);
}

// Walk the paginated list to collect every published post (list fields only).
export async function listAllPosts(): Promise<PostListItem[]> {
  const items: PostListItem[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const list = await listPosts({ page, pageSize: 50 });
    items.push(...list.items);
    totalPages = list.totalPages;
    page += 1;
  } while (page <= totalPages);
  return items;
}

export async function getPost(slug: string): Promise<Post | null> {
  const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(slug)}`);
  // 404 → the post doesn't exist (or is a draft); return null so the page can 404.
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`API request failed: GET /api/posts/${slug} → ${res.status}`);
  }
  const body = (await res.json()) as Envelope<Post>;
  return body.data;
}

// Full posts (with body/category/tags) for consumers that need them, e.g. RSS.
export async function listFullPosts(): Promise<Post[]> {
  const items = await listAllPosts();
  const posts = await Promise.all(items.map((item) => getPost(item.slug)));
  return posts.filter((post): post is Post => post !== null);
}

// Shiki highlighter, created once and reused for every code block on the page.
// `github-dark` matches Astro's default MDX syntax highlighting in apps/test.
const CODE_LANGUAGES: BundledLanguage[] = [
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "css",
  "scss",
  "html",
  "xml",
  "json",
  "yaml",
  "toml",
  "bash",
  "shellscript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "ruby",
  "php",
  "sql",
  "markdown",
  "dockerfile",
  "diff",
  "graphql",
];

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

async function loadHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ["github-dark"],
    langs: CODE_LANGUAGES,
  }).then((h) => {
    highlighter = h;
    return h;
  });
  return highlighterPromise;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// marked's renderer methods run synchronously — an `async code` renderer would
// be stringified to "[object Promise]" instead of awaited — so the highlighter
// is loaded ahead of time and codeToHtml() is called synchronously here.
// Wrap a highlighted `<pre>` in a container that carries a copy button. The
// button reads the raw code back off the `<code>` element when clicked.
function codeBlock(preHtml: string): string {
  return `<div class="code-block"><button type="button" class="code-copy" aria-label="Copy code">Copy</button>${preHtml}</div>`;
}

function highlightCode(code: string, lang?: string): string {
  if (!highlighter) {
    return codeBlock(`<pre><code class="language-${lang ?? ""}">${escapeHtml(code)}</code></pre>`);
  }
  try {
    return codeBlock(
      highlighter.codeToHtml(code, { lang: lang || "plaintext", theme: "github-dark" }),
    );
  } catch {
    return codeBlock(highlighter.codeToHtml(code, { lang: "plaintext", theme: "github-dark" }));
  }
}

const markdown = new Marked({
  renderer: {
    code({ text, lang }): string {
      return highlightCode(text, lang);
    },
  },
});
markdown.use(markedFootnote());

export async function renderMarkdown(content: string): Promise<string> {
  await loadHighlighter();
  return markdown.parse(content);
}
