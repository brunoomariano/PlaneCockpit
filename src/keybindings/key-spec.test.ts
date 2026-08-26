import { describe, it, expect } from "vitest";
import { isCtrlKey, isPlainKey, matchesKey, parseKeySpec } from "./key-spec.js";
import { ConfigError } from "../utils/errors.js";

describe("parseKeySpec", () => {
  it("parses a single character", () => {
    const spec = parseKeySpec("j");
    expect(spec).toMatchObject({ key: "j", ctrl: false, shift: false, meta: false });
  });

  it("treats uppercase letters as shift+letter", () => {
    const spec = parseKeySpec("G");
    expect(spec).toMatchObject({ key: "g", shift: true, raw: "shift+g" });
  });

  it("parses special keys case-insensitively", () => {
    expect(parseKeySpec("pageDown").key).toBe("pagedown");
    expect(parseKeySpec("PageDown").key).toBe("pagedown");
    expect(parseKeySpec("Enter").key).toBe("enter");
  });

  it("normalizes esc -> escape and return -> enter", () => {
    expect(parseKeySpec("esc").key).toBe("escape");
    expect(parseKeySpec("return").key).toBe("enter");
  });

  it("parses ctrl modifier", () => {
    const spec = parseKeySpec("ctrl+d");
    expect(spec).toMatchObject({ key: "d", ctrl: true });
  });

  it("parses combined modifiers", () => {
    const spec = parseKeySpec("ctrl+shift+r");
    expect(spec).toMatchObject({ key: "r", ctrl: true, shift: true });
  });

  it("treats explicit shift+letter the same way as uppercase shorthand", () => {
    expect(parseKeySpec("G").shift).toBe(true);
    expect(parseKeySpec("shift+g").shift).toBe(true);
    expect(parseKeySpec("shift+g").raw).toBe("shift+g");
  });

  it("rejects unknown modifiers", () => {
    expect(() => parseKeySpec("super+x")).toThrow(ConfigError);
  });

  it("rejects unknown multi-character keys", () => {
    expect(() => parseKeySpec("foobar")).toThrow(ConfigError);
  });

  it("rejects empty input", () => {
    expect(() => parseKeySpec("")).toThrow(ConfigError);
    expect(() => parseKeySpec("   ")).toThrow(ConfigError);
  });
});

describe("matchesKey", () => {
  it("matches a printable letter", () => {
    expect(matchesKey(parseKeySpec("j"), "j", {})).toBe(true);
    expect(matchesKey(parseKeySpec("j"), "k", {})).toBe(false);
  });

  it("matches a special key", () => {
    expect(matchesKey(parseKeySpec("escape"), "", { escape: true })).toBe(true);
    expect(matchesKey(parseKeySpec("pageDown"), "", { pageDown: true })).toBe(true);
  });

  it("differentiates ctrl-modified from plain key", () => {
    expect(matchesKey(parseKeySpec("ctrl+d"), "d", { ctrl: true })).toBe(true);
    expect(matchesKey(parseKeySpec("ctrl+d"), "d", { ctrl: false })).toBe(false);
    expect(matchesKey(parseKeySpec("d"), "d", { ctrl: true })).toBe(false);
  });

  it("differentiates shifted and unshifted printable keys", () => {
    expect(matchesKey(parseKeySpec("g"), "g", { shift: false })).toBe(true);
    expect(matchesKey(parseKeySpec("G"), "G", { shift: true })).toBe(true);
    expect(matchesKey(parseKeySpec("G"), "g", { shift: false })).toBe(false);
    expect(matchesKey(parseKeySpec("g"), "G", { shift: true })).toBe(false);
  });

  it("matches space", () => {
    expect(matchesKey(parseKeySpec("space"), " ", {})).toBe(true);
  });
});

// The hand-written single-key branches in the TUI compare the character exactly as
// typed, so a capital used to miss the comparison and a chord over the same letter
// used to hit it. These two predicates are the single place that decides both.
describe("isPlainKey", () => {
  it("matches a bare character", () => {
    expect(isPlainKey("y", {}, "y")).toBe(true);
  });

  // Caps lock must not leave a y/n prompt inert.
  it("matches the shifted character", () => {
    expect(isPlainKey("Y", { shift: true }, "y")).toBe(true);
  });

  it("rejects a ctrl or meta chord over the same letter", () => {
    expect(isPlainKey("y", { ctrl: true }, "y")).toBe(false);
    expect(isPlainKey("y", { meta: true }, "y")).toBe(false);
  });

  it("rejects another character and an empty input", () => {
    expect(isPlainKey("n", {}, "y")).toBe(false);
    expect(isPlainKey("", { return: true }, "y")).toBe(false);
  });
});

describe("isCtrlKey", () => {
  it("matches ctrl+letter", () => {
    expect(isCtrlKey("s", { ctrl: true }, "s")).toBe(true);
  });

  // A terminal in modifyOtherKeys mode reports ctrl+shift+s with an uppercase name.
  it("matches ctrl+shift+letter", () => {
    expect(isCtrlKey("S", { ctrl: true, shift: true }, "s")).toBe(true);
  });

  it("rejects the bare letter", () => {
    expect(isCtrlKey("s", {}, "s")).toBe(false);
  });
});
