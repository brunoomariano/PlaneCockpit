import { describe, it, expect } from "vitest";
import { normalizeFilters, filtersFingerprint } from "./filters.js";

describe("normalizeFilters", () => {
  it("returns empty when filters is undefined", () => {
    expect(normalizeFilters(undefined)).toEqual({});
  });

  it("wraps string assignee into array and sorts", () => {
    expect(normalizeFilters({ assignee: "me" }).assignees).toEqual(["me"]);
    expect(normalizeFilters({ assignee: ["b", "a"] }).assignees).toEqual(["a", "b"]);
  });

  it("drops empty arrays", () => {
    expect(normalizeFilters({ labels: [] })).toEqual({});
  });

  it("sorts arrays so fingerprint is stable regardless of input order", () => {
    const a = filtersFingerprint({ state_group: ["started", "unstarted"] });
    const b = filtersFingerprint({ state_group: ["unstarted", "started"] });
    expect(a).toBe(b);
  });

  it("different filters produce different fingerprints", () => {
    const a = filtersFingerprint({ priority: ["urgent"] });
    const b = filtersFingerprint({ priority: ["high"] });
    expect(a).not.toBe(b);
  });

  it("distinguishes views by state_search so they do not collide in cache", () => {
    const a = filtersFingerprint({ state_group: ["started"], state_search: ["In Review"] });
    const b = filtersFingerprint({ state_group: ["started"], state_search: ["Blocked"] });
    expect(a).not.toBe(b);
  });

  it("produces a stable fingerprint for equal state_search regardless of order", () => {
    const a = filtersFingerprint({ state_search: ["In Review", "Blocked"] });
    const b = filtersFingerprint({ state_search: ["Blocked", "In Review"] });
    expect(a).toBe(b);
  });
});
