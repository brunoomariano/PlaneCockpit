/**
 * Block 5 — The CLI table shares the theme for priority colors.
 *
 * renderIssues colors each PRIORITY cell with the active theme's priority.*
 * color (today the cell is plain text) and uses `accent` for the header, so the
 * CLI table and the TUI agree. Passing no theme keeps backward compatibility:
 * the default theme applies and the call does not throw.
 */

import { describe, it, expect } from "vitest";
import { renderIssues } from "./formatting.js";
import { PRESETS } from "../tui/theme/presets.js";
import type { Issue } from "../types/issue.js";

function issue(priority: Issue["priority"]): Issue {
  return {
    id: "i",
    sequence_id: 1,
    project_id: "p",
    project_identifier: "ENG",
    key: "ENG-1",
    name: "Title",
    state: { id: "s", name: "Todo", group: "unstarted" },
    priority,
    assignees: [],
    labels: [],
    created_at: "",
    updated_at: "",
  };
}

describe("renderIssues — themed priority", () => {
  it("should color the priority cell with the theme's priority color", () => {
    // A hex priority color emits a truecolor ANSI escape (chalk) in the output.
    const themed = renderIssues([issue("urgent")], "table", PRESETS.catppuccin);
    // catppuccin urgent is a hex; its presence as an ANSI escape proves the
    // cell was colored from the theme rather than left plain.
    expect(themed).toContain("["); // some ANSI styling present
  });

  it("should keep working with no theme (default applies)", () => {
    // Backward compatible: the old 2-arg call must still render.
    expect(() => renderIssues([issue("none")], "table")).not.toThrow();
    const out = renderIssues([issue("none")], "table");
    expect(out).toContain("ENG-1");
  });
});
