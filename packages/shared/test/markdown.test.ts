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
