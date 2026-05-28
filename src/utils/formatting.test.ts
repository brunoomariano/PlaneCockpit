import { describe, it, expect } from "vitest";
import { pickOutputFormat, priorityLabel, renderIssues, truncate } from "./formatting.js";
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
});

import { renderAny } from "./formatting.js";

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
