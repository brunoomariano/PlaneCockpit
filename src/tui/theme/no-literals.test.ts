/**
 * Block 4 — No raw color literals left in TUI components.
 *
 * The acceptance criterion "no raw color literals left in TUI components" is
 * enforced mechanically: this guard scans the component sources and fails if any
 * still hardcode a color (named or hex) on a `color=`/`borderColor=` prop. The
 * Ink boolean flags `dimColor`/`inverse` are not colors and are allowed; the
 * theme module and tests are excluded.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const COMPONENTS = [
  "src/tui/issue-list.tsx",
  "src/tui/view-selector.tsx",
  "src/tui/status-bar.tsx",
  "src/tui/help-modal.tsx",
  "src/tui/issue-detail.tsx",
  "src/tui/filter-box.tsx",
  "src/tui/error-boundary.tsx",
];

// A color literal is a named color or a hex passed to a color-ish prop or const.
const NAMED = "red|green|yellow|cyan|gray|grey|blue|magenta|white|black";
const LITERAL = new RegExp(`(color|borderColor)\\s*[=:]\\s*"(?:${NAMED})"|"#[0-9a-fA-F]{6}"`);

describe("no raw color literals in TUI components", () => {
  it("should reference theme tokens instead of color literals", () => {
    const offenders: string[] = [];
    for (const file of COMPONENTS) {
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        if (LITERAL.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, offenders.join("\n")).toHaveLength(0);
  });
});
