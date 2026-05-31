import { describe, it, expect } from "vitest";
import {
  pickOutputFormat,
  priorityLabel,
  renderIssues,
  renderAny,
  renderObject,
  truncate,
  padRight,
  padCenter,
} from "./formatting.js";
import type { Issue } from "../types/issue.js";

describe("pickOutputFormat", () => {
  it("returns json when --json is set", () => {
    expect(pickOutputFormat({ json: true })).toBe("json");
  });
  it("returns yaml when --yaml is set", () => {
    expect(pickOutputFormat({ yaml: true })).toBe("yaml");
  });
  it("defaults to table", () => {
    expect(pickOutputFormat({})).toBe("table");
  });
});

describe("priorityLabel", () => {
  it("maps known priorities to uppercase words", () => {
    expect(priorityLabel("urgent")).toBe("URGENT");
    expect(priorityLabel("high")).toBe("HIGH");
    expect(priorityLabel("medium")).toBe("MEDIUM");
    expect(priorityLabel("low")).toBe("LOW");
  });
  it("renders an em dash for none", () => {
    expect(priorityLabel("none")).toBe("—");
  });
});

describe("truncate", () => {
  it("preserves short strings", () => {
    expect(truncate("abc", 10)).toBe("abc");
  });
  it("truncates long strings with ellipsis", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
  });
});

const issue: Issue = {
  id: "i1",
  sequence_id: 1,
  project_id: "p1",
  project_identifier: "ENG",
  key: "ENG-1",
  name: "Hello",
  state: { id: "s", name: "Todo", group: "unstarted" },
  priority: "medium",
  assignees: [],
  labels: [],
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
};

describe("renderIssues", () => {
  it("renders json", () => {
    const out = renderIssues([issue], "json");
    expect(out).toContain('"ENG-1"');
  });

  it("renders yaml", () => {
    const out = renderIssues([issue], "yaml");
    expect(out).toContain("ENG-1");
  });

  it("renders a table including key and title", () => {
    const out = renderIssues([issue], "table");
    expect(out).toContain("ENG-1");
    expect(out).toContain("Hello");
  });

  it("labels the assignee column ASSIGN and lists assignee display names", () => {
    const assigned: Issue = {
      ...issue,
      assignees: [
        { id: "u1", display_name: "bruno" },
        { id: "u2", display_name: "ana" },
      ],
    };
    const out = renderIssues([assigned], "table");
    expect(out).toContain("ASSIGN");
    expect(out).toContain("bruno, ana");
  });

  // The title column is fixed-width so it fills the same span on every row up to
  // the ASSIGN column. A short title must be padded so the separator before
  // ASSIGN lands at the same offset as a long title would produce.
  it("pads short titles to a fixed width so ASSIGN stays right-aligned", () => {
    const short: Issue = { ...issue, name: "x", assignees: [{ id: "u", display_name: "bruno" }] };
    const long: Issue = {
      ...issue,
      name: "a very long issue title that exceeds the fixed column width and gets truncated here",
      assignees: [{ id: "u", display_name: "bruno" }],
    };
    const titleColumnEnd = (row: string): number => row.lastIndexOf("│ bruno");
    const shortRow = renderIssues([short], "table")
      .split("\n")
      .find((l) => l.includes("ENG-1"))!;
    const longRow = renderIssues([long], "table")
      .split("\n")
      .find((l) => l.includes("ENG-1"))!;
    expect(titleColumnEnd(shortRow)).toBe(titleColumnEnd(longRow));
  });
});

describe("renderAny", () => {
  it("returns strings as-is for table format", () => {
    expect(renderAny("hello", "table")).toBe("hello");
  });

  it("falls back to json for non-string table values", () => {
    expect(renderAny({ a: 1 }, "table")).toContain('"a": 1');
  });

  it("renders json", () => {
    expect(renderAny({ a: 1 }, "json")).toBe('{\n  "a": 1\n}');
  });

  it("renders yaml", () => {
    expect(renderAny({ a: 1 }, "yaml")).toContain("a: 1");
  });
});

describe("renderObject", () => {
  it("renders a single object as yaml in table mode (a table needs no single row)", () => {
    expect(renderObject({ a: 1 }, "table")).toContain("a: 1");
  });

  it("passes json/yaml through unchanged", () => {
    expect(renderObject({ a: 1 }, "json")).toBe('{\n  "a": 1\n}');
    expect(renderObject({ a: 1 }, "yaml")).toContain("a: 1");
  });
});

describe("padRight", () => {
  it("pads a short value to the requested width", () => {
    expect(padRight("ab", 5)).toBe("ab   ");
  });
  it("truncates an overflowing value, leaving a trailing space", () => {
    expect(padRight("abcdef", 4)).toBe("abc ");
  });
  it("treats null/undefined as an empty string", () => {
    expect(padRight(undefined, 3)).toBe("   ");
    expect(padRight(null, 2)).toBe("  ");
  });
});

describe("padCenter", () => {
  it("centers a short value within the width", () => {
    expect(padCenter("ab", 6)).toBe("  ab  ");
  });
  it("biases the extra space to the right for odd padding", () => {
    expect(padCenter("ab", 5)).toBe(" ab  ");
  });
  it("truncates an overflowing value without an ellipsis", () => {
    expect(padCenter("abcdef", 4)).toBe("abcd");
  });
  it("treats null/undefined as an empty string", () => {
    expect(padCenter(undefined, 2)).toBe("  ");
  });
});
