// State-duration derivation. Plane exposes no "time in current state" field on a
// work item (only created_at/updated_at and the current state), so we reconstruct
// it from the activity log: each state transition is a `field:"state"` event whose
// createdAt marks when the issue entered the new state. The last such event's
// createdAt is the entry time into the current state; with no transition the issue
// has sat in its first state since creation. These functions are pure — the
// adapter (plane/activities.ts) fetches the log; this turns it into a duration.

import type { IssueActivity } from "../types/activity.js";
import { isStateChange } from "../types/activity.js";

// currentStateEntry returns the ISO timestamp at which the issue entered its
// current state: the createdAt of the most recent state-change event, or the
// issue's createdAt when it has never changed state. Events are sorted by
// createdAt here so an out-of-order log (Plane does not guarantee order) still
// yields the latest transition.
export function currentStateEntry(
  activities: readonly IssueActivity[],
  issueCreatedAt: string,
): string {
  const transitions = activities
    .filter(isStateChange)
    .map((a) => a.createdAt)
    .sort();
  return transitions.at(-1) ?? issueCreatedAt;
}

// timeInCurrentState returns how long (ms) the issue has been in its current
// state, as wall-clock time between the state entry and `now`. A negative span
// (clock skew, or an entry timestamp in the future) is floored at 0 so the UI
// never shows a negative duration.
export function timeInCurrentState(
  activities: readonly IssueActivity[],
  issueCreatedAt: string,
  now: number,
): number {
  const entry = Date.parse(currentStateEntry(activities, issueCreatedAt));
  if (Number.isNaN(entry)) return 0;
  return Math.max(0, now - entry);
}
