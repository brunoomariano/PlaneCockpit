/**
 * textToHtml: plain-text -> minimal HTML for Plane descriptions.
 *
 * Plane only persists a description sent as `description_html`, so the editor's
 * plain text is wrapped into paragraphs. These tests pin the paragraph wrapping,
 * line-break preservation, HTML escaping, and the empty-clears case.
 */

import { describe, it, expect } from "vitest";
import { textToHtml } from "./text-to-html.js";

describe("textToHtml", () => {
  it("wraps a single line in a paragraph", () => {
    expect(textToHtml("hello world")).toBe("<p>hello world</p>");
  });

  it("turns each line into its own paragraph", () => {
    expect(textToHtml("line one\nline two")).toBe("<p>line one</p><p>line two</p>");
  });

  it("escapes HTML metacharacters so text is preserved literally", () => {
    expect(textToHtml("a < b && c > d")).toBe("<p>a &lt; b &amp;&amp; c &gt; d</p>");
  });

  it("returns an empty string for empty text (clears the description)", () => {
    expect(textToHtml("")).toBe("");
  });

  it("preserves a blank line as an empty paragraph", () => {
    expect(textToHtml("a\n\nb")).toBe("<p>a</p><p></p><p>b</p>");
  });
});
