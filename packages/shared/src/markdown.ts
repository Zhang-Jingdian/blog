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
