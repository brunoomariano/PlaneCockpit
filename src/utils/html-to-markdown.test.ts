import { describe, it, expect } from "vitest";
import { htmlToMarkdown } from "./html-to-markdown.js";

describe("htmlToMarkdown", () => {
  it("returns an empty string for empty input", () => {
    expect(htmlToMarkdown("")).toBe("");
  });

  it("converts paragraphs to plain text", () => {
    expect(htmlToMarkdown("<p>Hello world</p>")).toBe("Hello world");
  });

  it("converts headings", () => {
    expect(htmlToMarkdown("<h1>Title</h1>")).toBe("# Title");
    expect(htmlToMarkdown("<h2>Sub</h2>")).toBe("## Sub");
  });

  it("converts bullet lists", () => {
    const out = htmlToMarkdown("<ul><li>One</li><li>Two</li></ul>");
    expect(out).toMatch(/-\s+One/);
    expect(out).toMatch(/-\s+Two/);
  });

  it("converts inline code and code blocks", () => {
    expect(htmlToMarkdown("<p>use <code>x</code></p>")).toContain("`x`");
    const block = htmlToMarkdown("<pre><code>console.log(1)</code></pre>");
    expect(block).toContain("```");
    expect(block).toContain("console.log(1)");
  });

  // All three strikethrough tags must convert. `<strike>` is deprecated and
  // missing from TypeScript's HTMLElementTagNameMap, so it is easy to drop while
  // satisfying the compiler — legacy Plane content still contains it.
  it.each([
    ["<del>gone</del>", "~~gone~~"],
    ["<s>gone</s>", "~~gone~~"],
    ["<strike>gone</strike>", "~~gone~~"],
  ])("converts strikethrough %s", (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected);
  });

  it("converts links", () => {
    expect(htmlToMarkdown('<a href="https://x.com">link</a>')).toBe("[link](https://x.com)");
  });
});
