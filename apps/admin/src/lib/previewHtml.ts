// Builds a standalone HTML document for the "open in new window" post preview.
// It mirrors apps/test's blog post page exactly (Bear Blog base CSS + the
// BlogPost.astro article layout), minus the site's header and footer chrome.

export interface PreviewData {
  title: string;
  description: string | null;
  coverUrl: string | null;
  categoryName: string | null;
  tagNames: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  contentHtml: string;
}

// Mirrors apps/test/src/styles/global.css (Bear Blog) plus the inline styles
// from apps/test/src/layouts/BlogPost.astro.
const PREVIEW_CSS = `
:root {
  --accent: #2337ff;
  --accent-dark: #000d8a;
  --black: 15, 18, 25;
  --gray: 96, 115, 159;
  --gray-light: 229, 233, 240;
  --gray-dark: 34, 41, 57;
  --gray-gradient: rgba(var(--gray-light), 50%), #fff;
  --box-shadow:
    0 2px 6px rgba(var(--gray), 25%), 0 8px 24px rgba(var(--gray), 33%),
    0 16px 32px rgba(var(--gray), 33%);
}
body {
  font-family: "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif;
  margin: 0;
  padding: 0;
  text-align: left;
  background: linear-gradient(var(--gray-gradient)) no-repeat;
  background-size: 100% 600px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  color: rgb(var(--gray-dark));
  font-size: 20px;
  line-height: 1.7;
}
main {
  width: calc(100% - 2em);
  max-width: 100%;
  margin: 0;
  padding: 3em 1em;
}
h1,
h2,
h3,
h4,
h5,
h6 {
  margin: 0 0 0.5rem 0;
  color: rgb(var(--black));
  line-height: 1.2;
}
h1 {
  font-size: 3.052em;
}
h2 {
  font-size: 2.441em;
}
h3 {
  font-size: 1.953em;
}
h4 {
  font-size: 1.563em;
}
h5 {
  font-size: 1.25em;
}
strong,
b {
  font-weight: 700;
}
a {
  color: var(--accent);
}
a:hover {
  color: var(--accent);
}
p {
  margin-bottom: 1em;
}
.prose p {
  margin-bottom: 2em;
}
table {
  width: 100%;
}
img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}
code {
  padding: 2px 5px;
  background-color: rgb(var(--gray-light));
  border-radius: 2px;
}
pre {
  padding: 1.5em;
  border-radius: 8px;
  overflow-x: auto;
}
pre > code {
  all: unset;
}
blockquote {
  border-left: 4px solid var(--accent);
  padding: 0 0 0 20px;
  margin: 0;
  font-size: 1.333em;
}
hr {
  border: none;
  border-top: 1px solid rgb(var(--gray-light));
}

/* Article layout (apps/test/src/layouts/BlogPost.astro) */
.hero-image {
  width: 100%;
}
.hero-image img {
  display: block;
  margin: 0 auto;
  border-radius: 12px;
  box-shadow: var(--box-shadow);
}
.prose {
  width: 720px;
  max-width: calc(100% - 2em);
  margin: auto;
  padding: 1em;
  color: rgb(var(--gray-dark));
}
.title {
  margin-bottom: 1em;
  padding: 1em 0;
  text-align: center;
  line-height: 1;
}
.title h1 {
  margin: 0 0 0.5em 0;
}
.meta {
  margin: 0 0 0.5em;
  color: rgb(var(--gray));
}
.meta .date {
  margin-bottom: 0.5em;
}
.last-updated-on {
  font-style: italic;
}
.meta a {
  color: var(--accent);
  text-decoration: none;
  margin-right: 0.5em;
}
.description {
  margin: 0 0 1em;
  color: rgb(var(--gray));
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 720px) {
  body {
    font-size: 18px;
  }
  main {
    padding: 1em;
  }
}
`;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date | null): string {
  return d?.toLocaleDateString("en-us", { year: "numeric", month: "short", day: "numeric" }) ?? "";
}

export function buildPreviewHtml(data: PreviewData): string {
  const cover = data.coverUrl
    ? `<div class="hero-image"><img src="${escapeHtml(data.coverUrl)}" alt=""></div>`
    : "";
  const pubDate = parseDate(data.publishedAt);
  const updDate = parseDate(data.updatedAt);
  const published = formatDate(pubDate);
  const hasUpdate = pubDate != null && updDate != null && updDate.getTime() > pubDate.getTime();
  const date = pubDate
    ? `<div class="date">${escapeHtml(published)}${
        hasUpdate
          ? `<span class="last-updated-on"> · Last updated on ${escapeHtml(formatDate(updDate))}</span>`
          : ""
      }</div>`
    : "";
  const metaLinks = [
    data.categoryName ? `//${escapeHtml(data.categoryName)}` : "",
    ...data.tagNames.map((t) => `#${escapeHtml(t)}`),
  ]
    .filter(Boolean)
    .map((label) => `<a>${label}</a>`)
    .join("");
  const links = metaLinks ? `<div class="links">${metaLinks}</div>` : "";
  const meta = date || links ? `<div class="meta">${date}${links}</div>` : "";
  const description = data.description
    ? `<p class="description">${escapeHtml(data.description)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.title)}</title>
<style>${PREVIEW_CSS}</style>
</head>
<body>
<main>
  <article>
    ${cover}
    <div class="prose">
      <div class="title"><h1>${escapeHtml(data.title)}</h1></div>
      ${meta}${description}
      <hr>
      ${data.contentHtml}
    </div>

  </article>
</main>
</body>
</html>`;
}
