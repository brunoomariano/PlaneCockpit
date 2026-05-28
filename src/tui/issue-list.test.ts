import { describe, it, expect } from "vitest";
import { computeViewport } from "./issue-list.js";

describe("computeViewport", () => {
  it("returns empty when there are no rows or no items", () => {
    expect(computeViewport(0, 0, 10)).toEqual({ start: 0, end: 0 });
    expect(computeViewport(10, 0, 0)).toEqual({ start: 0, end: 0 });
  });

  it("returns the full list when it fits", () => {
    expect(computeViewport(5, 2, 10)).toEqual({ start: 0, end: 5 });
  });

  it("keeps the previous window when selection is inside it", () => {
    expect(computeViewport(50, 12, 10, 10)).toEqual({ start: 10, end: 20 });
  });

  it("scrolls down just enough when selection moves past the bottom", () => {
    expect(computeViewport(50, 25, 10, 10)).toEqual({ start: 16, end: 26 });
  });

  it("scrolls up when selection moves above the window", () => {
    expect(computeViewport(50, 4, 10, 20)).toEqual({ start: 4, end: 14 });
  });

  it("clamps the window to the list bounds", () => {
    expect(computeViewport(50, 49, 10)).toEqual({ start: 40, end: 50 });
  });

  it("handles selection past the end gracefully", () => {
    const { start, end } = computeViewport(50, 100, 10, 0);
    expect(end - start).toBe(10);
    expect(end).toBeLessThanOrEqual(50);
  });
});
