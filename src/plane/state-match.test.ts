/**
 * Slugify + state name matching helper.
 *
 * `state_search` matches an issue's `state.name` by slug — lowercased with all
 * whitespace removed — so "In Review", "in review", and "InReview" are treated
 * as the same state. These cases lock the slug rules and the matcher's no-op
 * behavior when there is nothing to search for.
 */

import { describe, it, expect } from "vitest";
import { slugifyState, matchesStateSearch } from "./state-match.js";

describe("slugifyState", () => {
  it("should produce the same slug for names differing only in case and spaces", () => {
    expect(slugifyState("In Review")).toBe(slugifyState("in review"));
    expect(slugifyState("In Review")).toBe(slugifyState("InReview"));
  });

  it("should lowercase and strip all whitespace", () => {
    expect(slugifyState("  QA Done ")).toBe("qadone");
  });
});

describe("matchesStateSearch", () => {
  it("should match when the slugified state name is in the search list", () => {
    expect(matchesStateSearch("In Review", ["Blocked", "In Review"])).toBe(true);
    expect(matchesStateSearch("Done", ["Blocked", "In Review"])).toBe(false);
  });

  it("should be a no-op (match everything) when the search list is empty or absent", () => {
    expect(matchesStateSearch("Anything", [])).toBe(true);
    expect(matchesStateSearch("Anything", undefined)).toBe(true);
  });
});
