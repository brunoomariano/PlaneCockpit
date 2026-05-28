import { describe, it, expect } from "vitest";
import { splitAnsiIntoLines, visibleWidth, wrapAnsiLine } from "./ansi-lines.js";

const RED = "\x1b[31m";
const RESET = "\x1b[0m";

describe("visibleWidth", () => {
  it("returns the printable length and ignores ANSI escapes", () => {
    expect(visibleWidth("hello")).toBe(5);
    expect(visibleWidth(`${RED}hello${RESET}`)).toBe(5);
    expect(visibleWidth(`${RED}a${RESET}b`)).toBe(2);
  });

  it("counts an empty string as zero", () => {
    expect(visibleWidth("")).toBe(0);
  });
});

describe("wrapAnsiLine", () => {
  it("returns the input unchanged when it fits", () => {
    expect(wrapAnsiLine("hello", 10)).toEqual(["hello"]);
  });

  it("wraps a long plain line to the requested width", () => {
    expect(wrapAnsiLine("abcdefgh", 3)).toEqual(["abc", "def", "gh"]);
  });

  it("preserves ANSI escapes inside the wrap", () => {
    const line = `${RED}abcdefgh${RESET}`;
    const wrapped = wrapAnsiLine(line, 3);
    expect(wrapped.length).toBe(3);
    expect(visibleWidth(wrapped[0] ?? "")).toBe(3);
    expect(visibleWidth(wrapped[1] ?? "")).toBe(3);
    expect(visibleWidth(wrapped[2] ?? "")).toBe(2);
  });

  it("returns input as-is for non-positive width", () => {
    expect(wrapAnsiLine("abc", 0)).toEqual(["abc"]);
  });
});

describe("splitAnsiIntoLines", () => {
  it("returns an empty list for empty input", () => {
    expect(splitAnsiIntoLines("", 10)).toEqual([]);
  });

  it("preserves explicit blank lines from hard breaks", () => {
    expect(splitAnsiIntoLines("a\n\nb", 10)).toEqual(["a", "", "b"]);
  });

  it("soft-wraps long rows to the column width", () => {
    expect(splitAnsiIntoLines("abcdef\n123", 3)).toEqual(["abc", "def", "123"]);
  });
});
