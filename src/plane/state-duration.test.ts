/**
 * Block — state-duration: reconstructing "time in current state" from the log.
 *
 * Plane has no time-in-state field, so currentStateEntry/timeInCurrentState
 * derive it from the activity log's `field:"state"` events. These tests cover the
 * never-changed case (falls back to the issue's createdAt), one and several
 * transitions (the latest wins), non-state events being ignored, out-of-order
 * logs, and the negative-span floor.
 */

import { describe, it, expect } from "vitest";
import { currentStateEntry, timeInCurrentState } from "./state-duration.js";
import type { IssueActivity } from "../types/activity.js";

function activity(partial: Partial<IssueActivity>): IssueActivity {
  return {
    id: partial.id ?? "a",
    verb: partial.verb ?? "updated",
    field: partial.field,
    oldValue: partial.oldValue,
    newValue: partial.newValue,
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    actor: partial.actor,
  };
}

const CREATED_AT = "2026-06-01T00:00:00.000Z";

describe("currentStateEntry", () => {
  // With no state transition, the issue has been in its first state since it
  // was created, so the entry time is the issue's createdAt.
  it("falls back to the issue createdAt when there is no state change", () => {
    const log = [activity({ field: "priority", createdAt: "2026-06-02T00:00:00.000Z" })];
    expect(currentStateEntry(log, CREATED_AT)).toBe(CREATED_AT);
  });

  // A single state change sets the entry time to that transition's timestamp.
  it("uses the only state-change timestamp", () => {
    const log = [
      activity({
        field: "state",
        oldValue: "Inbox",
        newValue: "Backlog",
        createdAt: "2026-06-05T10:00:00.000Z",
      }),
    ];
    expect(currentStateEntry(log, CREATED_AT)).toBe("2026-06-05T10:00:00.000Z");
  });

  // Several transitions: the latest one is when the issue entered its current
  // state. Non-state events interleaved must not affect the result.
  it("picks the most recent state change among many events", () => {
    const log = [
      activity({ field: "state", createdAt: "2026-06-05T10:00:00.000Z" }),
      activity({ field: "priority", createdAt: "2026-06-06T10:00:00.000Z" }),
      activity({ field: "state", createdAt: "2026-06-07T10:00:00.000Z" }),
      activity({ field: "assignees", createdAt: "2026-06-08T10:00:00.000Z" }),
    ];
    expect(currentStateEntry(log, CREATED_AT)).toBe("2026-06-07T10:00:00.000Z");
  });

  // Plane does not guarantee chronological order in the log; the latest
  // transition must win regardless of array position.
  it("handles an out-of-order log", () => {
    const log = [
      activity({ field: "state", createdAt: "2026-06-07T10:00:00.000Z" }),
      activity({ field: "state", createdAt: "2026-06-05T10:00:00.000Z" }),
    ];
    expect(currentStateEntry(log, CREATED_AT)).toBe("2026-06-07T10:00:00.000Z");
  });
});

describe("timeInCurrentState", () => {
  // Wall-clock span between the entry and now.
  it("returns the elapsed ms since the current-state entry", () => {
    const entry = "2026-06-07T10:00:00.000Z";
    const log = [activity({ field: "state", createdAt: entry })];
    const now = Date.parse("2026-06-07T13:30:00.000Z"); // +3h30m
    expect(timeInCurrentState(log, CREATED_AT, now)).toBe(3 * 3_600_000 + 30 * 60_000);
  });

  // No transition: measured from the issue's createdAt.
  it("measures from createdAt when the state never changed", () => {
    const now = Date.parse("2026-06-02T00:00:00.000Z"); // +1 day
    expect(timeInCurrentState([], CREATED_AT, now)).toBe(86_400_000);
  });

  // Clock skew (entry in the future relative to now) is floored at 0, never
  // surfacing a negative duration to the UI.
  it("floors a negative span at 0", () => {
    const log = [activity({ field: "state", createdAt: "2026-06-10T00:00:00.000Z" })];
    const now = Date.parse("2026-06-09T00:00:00.000Z");
    expect(timeInCurrentState(log, CREATED_AT, now)).toBe(0);
  });
});
