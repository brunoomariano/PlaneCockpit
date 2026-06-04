import type { IssueLabel, IssuePriority, IssueState, IssueUser } from "../types/issue.js";
import type { SelectOption } from "./select-modal.js";

// The five priorities, in descending order, behind priorityOptions().
const PRIORITIES: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];

// Builders turning each domain list into picker options. Shared by useIssueEditor
// and useIssueCreator so both render the same option shapes (and the same
// defensive filtering of id-less rows).
export function priorityOptions(): SelectOption[] {
  return PRIORITIES.map((p) => ({ value: p, label: p }));
}

export function stateOptions(states: IssueState[]): SelectOption[] {
  return states.map((s) => ({ value: s.id, label: s.name, group: s.group }));
}

export function memberOptions(members: IssueUser[]): SelectOption[] {
  // Defensive: a member row from a self-hosted Plane may arrive without an id
  // (pending invite). Drop those so the picker never renders a value-less option.
  return members
    .filter((m): m is IssueUser => Boolean(m?.id))
    .map((m) => ({ value: m.id, label: m.display_name ?? m.id }));
}

export function labelOptions(labels: IssueLabel[]): SelectOption[] {
  return labels.filter((l) => Boolean(l?.id)).map((l) => ({ value: l.id, label: l.name }));
}
