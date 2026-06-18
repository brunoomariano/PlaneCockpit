// IssueActivity is the internal domain model for one entry of a work item's
// activity log. Plane records a row per field change (and creation/relation
// events); this captures the fields the detail view needs. Construction and the
// state-change derivation live in separate functions (plane/activities.ts,
// plane/state-duration.ts), keeping this a fields-only type.

// IssueActivity is a single change recorded against an issue. `field` is the
// changed attribute ("state", "priority", "assignees", …) or undefined for
// lifecycle events such as creation. For a state change, `oldValue`/`newValue`
// hold the human-readable state names and `createdAt` is when it happened.
export interface IssueActivity {
  id: string;
  // verb is Plane's event kind: "created", "updated", "deleted".
  verb: string;
  // field is the attribute that changed, or undefined for the creation event.
  field?: string;
  // The value before/after the change, as Plane stored it (names for states).
  oldValue?: string;
  newValue?: string;
  // ISO-8601 timestamp of the change; the clock for "time in state".
  createdAt: string;
  // actor is the id of the member who made the change, when Plane reports one.
  actor?: string;
}

// The `field` value Plane uses for a state transition; the marker both the
// duration derivation and the activity-log view filter on.
const STATE_FIELD = "state";

// isStateChange narrows an activity to a state transition — the only events the
// "time in state" calculation and the activity-log tab consider.
export function isStateChange(activity: IssueActivity): boolean {
  return activity.field === STATE_FIELD;
}
