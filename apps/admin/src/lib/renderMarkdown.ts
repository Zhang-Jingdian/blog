import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import { createHighlighter, type BundledLanguage, type Highlighter } from "shiki";

// Renders the post's markdown the same way the website does (marked + Shiki,
// github-dark), so the editor's preview pane matches the published page.
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
