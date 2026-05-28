import { describe, it, expect } from "vitest";
import { markdownToAnsi } from "./markdown-to-ansi.js";

// Tests focus on structural content (substrings that should be present)
// rather than the exact ANSI sequences, which are an implementation detail.

describe("markdownToAnsi", () => {
  it("returns empty string for empty input", () => {
    expect(markdownToAnsi("")).toBe("");
  });

  it("renders paragraphs", () => {
    expect(markdownToAnsi("Hello world")).toContain("Hello world");
  });

  it("renders headings with their prefix", () => {
    const out = markdownToAnsi("# Title");
    expect(out).toContain("# Title");
  });

  it("renders unordered lists with bullets", () => {
    const out = markdownToAnsi("- One\n- Two");
    expect(out).toContain("•");
    expect(out).toContain("One");
    expect(out).toContain("Two");
  });

  it("renders ordered lists with numbers", () => {
    const out = markdownToAnsi("1. First\n2. Second");
    expect(out).toContain("1.");
    expect(out).toContain("First");
    expect(out).toContain("2.");
    expect(out).toContain("Second");
  });

  it("renders inline code", () => {
    expect(markdownToAnsi("use `foo` now")).toContain("foo");
  });

  it("renders fenced code blocks with language label", () => {
    const out = markdownToAnsi("```ts\nconst x = 1;\n```");
    expect(out).toContain("ts");
    expect(out).toContain("const x = 1;");
  });

  it("renders links with label and url", () => {
    const out = markdownToAnsi("[plane](https://plane.so)");
    expect(out).toContain("plane");
    expect(out).toContain("(https://plane.so)");
  });

  it("renders bold and italic without throwing", () => {
    expect(markdownToAnsi("**bold** and _italic_")).toContain("bold");
  });

  it("renders strikethrough", () => {
    expect(markdownToAnsi("~~gone~~")).toContain("gone");
  });

  it("renders blockquotes", () => {
    const out = markdownToAnsi("> quoted");
    expect(out).toContain("quoted");
    expect(out).toContain("│");
  });

  it("renders horizontal rules", () => {
    expect(markdownToAnsi("---")).toContain("─");
  });

  it("strips raw HTML tags but keeps the text", () => {
    expect(markdownToAnsi("<span>x</span>")).toContain("x");
  });
});
