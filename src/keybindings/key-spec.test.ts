import { describe, it, expect } from "vitest";
import { matchesKey, parseKeySpec } from "./key-spec.js";
import { ConfigError } from "../utils/errors.js";

describe("parseKeySpec", () => {
  it("parses a single character", () => {
    const spec = parseKeySpec("j");
    expect(spec).toMatchObject({ key: "j", ctrl: false, shift: false, meta: false });
  });

  it("treats uppercase letters as shift+letter", () => {
    const spec = parseKeySpec("G");
    expect(spec).toMatchObject({ key: "G", shift: true });
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

  it("matches space", () => {
    expect(matchesKey(parseKeySpec("space"), " ", {})).toBe(true);
  });
});
