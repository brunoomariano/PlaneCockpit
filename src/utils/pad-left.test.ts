/**
 * Bloco 4 — Right-align padding helper.
 *
 * The renderer aligns a cell `right` by padding spaces on the LEFT. Today
 * formatting.ts has `padRight` (text left, spaces right = left-align) and
 * `padCenter`; the right-align helper is missing. `padLeft` pads on the left to
 * `width`, and truncates (no ellipsis) when the value overflows, matching the
 * fixed-width-cell contract of the other two.
 */

import { describe, it, expect } from "vitest";
import { padLeft } from "../utils/formatting.js";

describe("padLeft — right alignment", () => {
  it("should pad spaces on the left to reach the width", () => {
    expect(padLeft("U", 4)).toBe("   U");
    expect(padLeft("ab", 5)).toBe("   ab");
  });

  it("should pass through a value that already fills the width", () => {
    expect(padLeft("abcd", 4)).toBe("abcd");
  });

  it("should truncate without ellipsis when the value overflows", () => {
    // Mirrors padCenter's overflow behaviour (slice, no ellipsis).
    expect(padLeft("abcdef", 4)).toBe("abcd");
  });

  it("should treat null/undefined as empty", () => {
    expect(padLeft(undefined, 3)).toBe("   ");
    expect(padLeft(null, 2)).toBe("  ");
  });
});
