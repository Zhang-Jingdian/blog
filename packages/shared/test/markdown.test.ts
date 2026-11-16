import { describe, expect, it } from "vite-plus/test";

import { renderMarkdown } from "../src/index.ts";

describe("renderMarkdown", () => {
  it("highlights a fenced code block with the copy-button wrapper", async () => {
    const html = await renderMarkdown("```ts\nconst answer: number = 42;\n```");

    expect(html).toContain('class="code-block"');
    expect(html).toContain("shiki");
    expect(html).toContain("answer");
  });

  it("keeps bash fences working through the shellscript grammar alias", async () => {
    const html = await renderMarkdown("```bash\necho hi\n```");

    expect(html).toContain("shiki");
    expect(html).toContain("echo");
  });

  it("falls back to plaintext for an unknown language", async () => {
    const html = await renderMarkdown("```not-a-real-lang\nplain text\n```");

    expect(html).toContain('class="code-block"');
    expect(html).toContain("plain text");
  });

  it("renders footnotes", async () => {
    const html = await renderMarkdown("Body[^1]\n\n[^1]: The note.");

    expect(html).toContain("footnote");
    expect(html).toContain("The note.");
  });
});

describe("renderMarkdown raw HTML", () => {
  it("escapes a script tag instead of emitting it", async () => {
    const html = await renderMarkdown('<script>alert("xss")</script>');

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops event-handler attributes from an allowed tag", async () => {
    const html = await renderMarkdown('<kbd onmouseover="alert(1)">Ctrl</kbd>');

    expect(html).toContain("<kbd>Ctrl</kbd>");
    expect(html).not.toContain("onmouseover");
  });

  it("escapes an image with an inline handler", async () => {
    const html = await renderMarkdown('<img src="x" onerror="alert(1)">');

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("keeps allowlisted presentational tags", async () => {
    const html = await renderMarkdown("a<br>b <mark>hi</mark>");

    expect(html).toContain("<br>");
    expect(html).toContain("<mark>hi</mark>");
  });

  it("escapes block-level HTML but keeps its text readable", async () => {
    const html = await renderMarkdown('<div class="x">hello</div>');

    expect(html).not.toContain("<div");
    expect(html).toContain("&lt;div");
    expect(html).toContain("hello");
  });

  it("refuses javascript: URLs in links and images", async () => {
    const link = await renderMarkdown("[click](javascript:alert(1))");
    const image = await renderMarkdown("![x](javascript:alert(1))");

    expect(link).not.toContain("javascript:");
    expect(image).not.toContain("javascript:");
  });

  it("refuses entity-obfuscated and whitespace-split schemes", async () => {
    const numeric = await renderMarkdown("[click](&#106;avascript:alert(1))");
    const hex = await renderMarkdown("[click](&#x6a;avascript:alert(1))");
    const spaced = await renderMarkdown("[click](java\tscript:alert(1))");

    expect(numeric).not.toContain("javascript:");
    expect(hex).not.toContain("javascript:");
    expect(spaced).not.toContain("javascript:");
  });

  it("keeps http, https, mailto and relative links", async () => {
    const html = await renderMarkdown(
      "[a](https://example.com) [b](/blog/x) [c](mailto:me@example.com)",
    );

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="/blog/x"');
    expect(html).toContain('href="mailto:me@example.com"');
  });
});
