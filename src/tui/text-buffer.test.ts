import { describe, it, expect } from "vitest";
import { emptyBuffer, applyKey, isBlank } from "./text-buffer.js";
import type { InkKey } from "../keybindings/key-spec.js";

function k(over: Partial<InkKey> = {}): InkKey {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    return: false,
    escape: false,
    ctrl: false,
    backspace: false,
    delete: false,
    meta: false,
    shift: false,
    tab: false,
    pageDown: false,
    pageUp: false,
    ...over,
  } as InkKey;
}

describe("applyKey", () => {
  it("inserts printable characters at the caret", () => {
    let b = emptyBuffer();
    b = applyKey(b, "h", k());
    b = applyKey(b, "i", k());
    expect(b).toEqual({ text: "hi", caret: 2 });
  });

  it("inserts a newline on return", () => {
    let b = applyKey(emptyBuffer(), "a", k());
    b = applyKey(b, "", k({ return: true }));
    b = applyKey(b, "b", k());
    expect(b.text).toBe("a\nb");
  });

  it("backspaces the character before the caret", () => {
    let b = applyKey(applyKey(emptyBuffer(), "a", k()), "b", k());
    b = applyKey(b, "", k({ backspace: true }));
    expect(b).toEqual({ text: "a", caret: 1 });
  });

  it("moves the caret with arrows and inserts in the middle", () => {
    let b = applyKey(applyKey(emptyBuffer(), "a", k()), "c", k());
    b = applyKey(b, "", k({ leftArrow: true }));
    b = applyKey(b, "b", k());
    expect(b.text).toBe("abc");
  });

  // Control chords (e.g. ctrl+s submit) must not leak characters into the buffer.
  it("ignores ctrl/meta chords", () => {
    const b = applyKey(emptyBuffer(), "s", k({ ctrl: true }));
    expect(b).toEqual({ text: "", caret: 0 });
  });
});

describe("isBlank", () => {
  it("is true for empty and whitespace-only buffers", () => {
    expect(isBlank(emptyBuffer())).toBe(true);
    expect(isBlank({ text: "  \n\t", caret: 0 })).toBe(true);
  });

  it("is false once there is real content", () => {
    expect(isBlank({ text: "hi", caret: 2 })).toBe(false);
  });
});
