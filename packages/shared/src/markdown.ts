import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Languages are imported explicitly instead of using `createHighlighter` from
// "shiki": the bundled entry pulls every grammar Shiki ships (~300 dynamic
// chunks, ~10 MB in the admin bundle), while only these are ever used. Add a
// language here to support it in code fences.
import c from "shiki/langs/c.mjs";
import cpp from "shiki/langs/cpp.mjs";
import csharp from "shiki/langs/csharp.mjs";
import css from "shiki/langs/css.mjs";
import diff from "shiki/langs/diff.mjs";
import dockerfile from "shiki/langs/dockerfile.mjs";
import go from "shiki/langs/go.mjs";
import graphql from "shiki/langs/graphql.mjs";
import html from "shiki/langs/html.mjs";
import java from "shiki/langs/java.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import jsx from "shiki/langs/jsx.mjs";
import markdownLang from "shiki/langs/markdown.mjs";
import php from "shiki/langs/php.mjs";
import python from "shiki/langs/python.mjs";
import ruby from "shiki/langs/ruby.mjs";
import rust from "shiki/langs/rust.mjs";
import scss from "shiki/langs/scss.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import sql from "shiki/langs/sql.mjs";
import toml from "shiki/langs/toml.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import xml from "shiki/langs/xml.mjs";
import yaml from "shiki/langs/yaml.mjs";
import githubDark from "shiki/themes/github-dark.mjs";

// `shellscript` also answers to `bash`, `sh` and `zsh` through the grammar's
// own aliases, so ` ```bash ` keeps working.
const LANGUAGES = [
  javascript,
  typescript,
  tsx,
  jsx,
  css,
  scss,
  html,
  xml,
  json,
  yaml,
  toml,
  shellscript,
  python,
  java,
  c,
  cpp,
  csharp,
  go,
  rust,
  ruby,
  php,
  sql,
  markdownLang,
  dockerfile,
  diff,
  graphql,
].flat();

type Highlighter = Awaited<ReturnType<typeof createHighlighterCore>>;

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

function loadHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighterCore({
    themes: [githubDark],
    langs: LANGUAGES,
    // The JavaScript regex engine avoids shipping the ~600 KB Oniguruma WASM
    // binary. `forgiving` skips grammar patterns it cannot compile instead of
    // failing the whole highlighter.
    engine: createJavaScriptRegexEngine({ forgiving: true }),
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

// Wrap a highlighted `<pre>` in a container that carries a copy button. The
// button reads the raw code back off the `<code>` element when clicked.
function codeBlock(preHtml: string): string {
  return `<div class="code-block"><button type="button" class="code-copy" aria-label="Copy code">Copy</button>${preHtml}</div>`;
}

// Presentational tags a post is allowed to embed. Everything else is escaped and
// shown as literal text.
const RAW_HTML_TAGS = new Set(["br", "kbd", "mark", "sub", "sup", "small", "del", "ins"]);

// marked passes raw HTML straight through, and the site injects the result with
// `set:html` (the admin preview does the same with document.write into a
// same-origin window). A post containing `<script>` or `<img onerror=…>` would
// therefore execute in the reader's browser — and in the admin's origin, where
// the Cloudflare Access cookie is attached to same-origin requests.
//
// Rather than adding a full sanitiser dependency, this re-emits only the
// allowlisted tags and *never* their attributes: every XSS payload that matters
// (`onerror`, `onclick`, `style`, `href="javascript:"`, `srcdoc`) needs an
// attribute, so dropping attributes removes the attack surface. Disallowed tags
// are escaped, which keeps the text visible instead of silently deleting it.
function sanitizeRawHtml(raw: string): string {
  let out = "";
  let cursor = 0;
  for (const match of raw.matchAll(/<[^>]*>/g)) {
    const start = match.index ?? 0;
    out += escapeHtml(raw.slice(cursor, start));
    cursor = start + match[0].length;

    const parsed = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(match[0]);
    const name = parsed?.[2]?.toLowerCase();
    if (parsed && name && RAW_HTML_TAGS.has(name)) {
      out += parsed[1] ? `</${name}>` : `<${name}>`;
    } else {
      out += escapeHtml(match[0]);
    }
  }
  return out + escapeHtml(raw.slice(cursor));
}

const SAFE_PROTOCOLS = new Set(["http", "https", "mailto", "tel"]);

function codePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : "\uFFFD";
}

// The browser decodes character references before resolving a URL, so
// `&#106;avascript:` has to be recognized here as `javascript:`.
function decodeEntities(text: string): string {
  const NAMED: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    colon: ":",
    tab: "\t",
    newline: "\n",
  };
  return text
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => codePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED[name.toLowerCase()] ?? match);
}

// marked 18 no longer filters URL schemes (its old cleanUrl helper is gone), so
// `[x](javascript:alert(1))` would otherwise become a working link. Keep only
// protocols that cannot execute, and let relative/anchor URLs through untouched.
function safeUrl(raw: string): string | null {
  // Whitespace and control characters are stripped before the scheme is read, so
  // `java\tscript:` cannot slip through and be treated as a relative URL.
  const normalized = decodeEntities(raw)
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 0x20 && code !== 0x7f;
    })
    .join("");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(normalized);
  if (!scheme) return raw;
  return SAFE_PROTOCOLS.has(scheme[1]!.toLowerCase()) ? raw : null;
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

// marked's renderer methods run synchronously — an `async code` renderer would
// be stringified to "[object Promise]" instead of awaited — so the highlighter
// is loaded ahead of time and codeToHtml() is called synchronously here.
const markdown = new Marked({
  // Runs before rendering, so an unsafe href never reaches the renderer.
  walkTokens(token) {
    if ((token.type === "link" || token.type === "image") && safeUrl(token.href) === null) {
      token.href = "";
    }
  },
  renderer: {
    code({ text, lang }): string {
      return highlightCode(text, lang);
    },
    // Raw HTML never reaches the page as markup; see sanitizeRawHtml above.
    html({ text }): string {
      return sanitizeRawHtml(text);
    },
  },
});
markdown.use(markedFootnote());

export async function renderMarkdown(content: string): Promise<string> {
  await loadHighlighter();
  return markdown.parse(content);
}
