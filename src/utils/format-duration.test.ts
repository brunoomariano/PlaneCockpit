/**
 * Block — humanizeDuration: compact two-unit duration formatting.
 *
 * Covers the sub-minute "just now" floor, single-unit spans, the two-largest-unit
 * cap (days suppress the minute remainder), and exact unit boundaries.
 */

import { describe, it, expect } from "vitest";
import { humanizeDuration } from "./format-duration.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("humanizeDuration", () => {
  it.each([
    [0, "just now"],
    [30_000, "just now"],
    [MIN, "1m"],
    [12 * MIN, "12m"],
    [HOUR, "1h"],
    [HOUR + 30 * MIN, "1h 30m"],
    [DAY, "1d"],
    [DAY + 4 * HOUR, "1d 4h"],
    // Beyond a day the minute remainder is dropped (two-unit cap, days + hours).
    [3 * DAY + 4 * HOUR + 15 * MIN, "3d 4h"],
    // A whole number of days shows just the day unit (no trailing 0h).
    [5 * DAY, "5d"],
  ])("formats %ims as %s", (ms, expected) => {
    expect(humanizeDuration(ms)).toBe(expected);
  });
});
