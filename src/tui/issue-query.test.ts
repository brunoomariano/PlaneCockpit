/**
 * Structured filter query: parsing and matching.
 *
 * The `/` filter accepts gh-dash-style key:value tokens (ass/state/group/prio/
 * label/proj) plus bare words (title/key substring). These tests pin parsing
 * (typed tokens, bare words, unknown-key fallthrough), and matching (AND across
 * keys, OR within a key, enum vs substring fields, and ass:me resolution).
 */

import { describe, it, expect } from "vitest";
import { parseQuery, matchesQuery, formatListPosition } from "./issue-query.js";
import type { Issue } from "../types/issue.js";

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "i1",
    sequence_id: 1,
    project_id: "p1",
    project_identifier: "ENG",
    key: "ENG-1",
    name: "Login bug",
    state: { id: "s1", name: "In Progress", group: "started" },
    priority: "high",
    assignees: [{ id: "u-me", display_name: "Ana" }],
    labels: [{ id: "l1", name: "bug" }],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("parseQuery", () => {
  it("parses typed tokens and bare words", () => {
    expect(parseQuery("ass:joe login")).toEqual([
      { key: "ass", value: "joe" },
      { key: "text", value: "login" },
    ]);
  });

  it("treats an unknown key as a bare text token", () => {
    expect(parseQuery("foo:bar")).toEqual([{ key: "text", value: "foo:bar" }]);
  });

  it("treats a key with an empty value as text", () => {
    expect(parseQuery("ass:")).toEqual([{ key: "text", value: "ass:" }]);
  });

  it("returns no terms for blank input", () => {
    expect(parseQuery("   ")).toEqual([]);
  });
});

describe("matchesQuery", () => {
  it("matches everything when there are no terms", () => {
    expect(matchesQuery(issue(), [])).toBe(true);
  });

  it("matches a bare word against title or key", () => {
    expect(matchesQuery(issue(), parseQuery("login"))).toBe(true);
    expect(matchesQuery(issue(), parseQuery("ENG-1"))).toBe(true);
    expect(matchesQuery(issue(), parseQuery("nope"))).toBe(false);
  });

  it("matches state by substring and group/priority/project exactly", () => {
    expect(matchesQuery(issue(), parseQuery("state:prog"))).toBe(true);
    expect(matchesQuery(issue(), parseQuery("group:started"))).toBe(true);
    expect(matchesQuery(issue(), parseQuery("prio:high"))).toBe(true);
    expect(matchesQuery(issue(), parseQuery("proj:ENG"))).toBe(true);
    expect(matchesQuery(issue(), parseQuery("group:backlog"))).toBe(false);
  });

  it("ANDs terms of different keys", () => {
    expect(matchesQuery(issue(), parseQuery("prio:high label:bug"))).toBe(true);
    expect(matchesQuery(issue(), parseQuery("prio:high label:missing"))).toBe(false);
  });

  it("ORs repeated terms of the same key", () => {
    const i = issue({ labels: [{ id: "l1", name: "bug" }] });
    expect(matchesQuery(i, parseQuery("label:bug label:ui"))).toBe(true);
    expect(matchesQuery(i, parseQuery("label:ux label:ui"))).toBe(false);
  });

  it("resolves ass:me against the current user id", () => {
    expect(matchesQuery(issue(), parseQuery("ass:me"), { meId: "u-me" })).toBe(true);
    expect(matchesQuery(issue(), parseQuery("ass:me"), { meId: "someone-else" })).toBe(false);
    // Without a known meId, ass:me matches nothing rather than throwing.
    expect(matchesQuery(issue(), parseQuery("ass:me"), {})).toBe(false);
  });

  it("matches an assignee by display-name substring", () => {
    expect(matchesQuery(issue(), parseQuery("ass:an"))).toBe(true);
    expect(matchesQuery(issue(), parseQuery("ass:zz"))).toBe(false);
  });
});

describe("formatListPosition", () => {
  // Cursor position when not filtering: 1-based index over the loaded rows.
  it("shows the 1-based cursor over the total when not filtering", () => {
    expect(formatListPosition({ selected: 0, matched: 2, total: 2, filtering: false })).toBe("1/2");
  });

  // While filtering, matches append the "(matched of total)" suffix.
  it("appends the match suffix when filtering with matches", () => {
    expect(formatListPosition({ selected: 1, matched: 3, total: 5, filtering: true })).toBe(
      "2/3 (3 of 5)",
    );
  });

  // Zero matches under an active filter must still report the count (regression:
  // a falsy 0 previously rendered as an empty count, "  of N").
  it("reports 0 of total when a filter matches nothing", () => {
    expect(formatListPosition({ selected: 0, matched: 0, total: 2, filtering: true })).toBe(
      "0 of 2",
    );
  });

  // No filter and no rows: the status bar omits the segment entirely.
  it("is undefined with no filter and no rows", () => {
    expect(
      formatListPosition({ selected: 0, matched: 0, total: 0, filtering: false }),
    ).toBeUndefined();
  });
});
