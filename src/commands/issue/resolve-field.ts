import type { IssueState, IssueLabel } from "../../types/issue.js";
import { NotFoundError } from "../../utils/errors.js";

// resolveStateByNameOrId maps a user-supplied state token (a name,
// case-insensitive, or an id) to a state id within the issue's project. An
// unknown or ambiguous name throws with the valid options so the operator can
// correct it. An exact id match wins outright (ids are unique).
export function resolveStateByNameOrId(input: string, states: IssueState[]): string {
  const byId = states.find((s) => s.id === input);
  if (byId) return byId.id;
  const needle = input.trim().toLowerCase();
  const byName = states.filter((s) => s.name.toLowerCase() === needle);
  if (byName.length === 1) return byName[0]!.id;
  const names = states.map((s) => s.name).join(", ");
  if (byName.length === 0) {
    throw new NotFoundError(`unknown state: ${input} (valid: ${names})`);
  }
  throw new NotFoundError(`ambiguous state: ${input} (valid: ${names})`);
}

// resolveLabelsByNameOrId maps each user-supplied label token (name or id) to a
// label id within the project, preserving order and de-duplicating. Any unknown
// or ambiguous token throws with the valid options. An empty input list yields
// an empty result (clearing the labels).
export function resolveLabelsByNameOrId(inputs: string[], labels: IssueLabel[]): string[] {
  const ids: string[] = [];
  for (const input of inputs) {
    const id = resolveOneLabel(input, labels);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function resolveOneLabel(input: string, labels: IssueLabel[]): string {
  const byId = labels.find((l) => l.id === input);
  if (byId) return byId.id;
  const needle = input.trim().toLowerCase();
  const byName = labels.filter((l) => l.name.toLowerCase() === needle);
  if (byName.length === 1) return byName[0]!.id;
  const names = labels.map((l) => l.name).join(", ");
  if (byName.length === 0) {
    throw new NotFoundError(`unknown label: ${input} (valid: ${names})`);
  }
  throw new NotFoundError(`ambiguous label: ${input} (valid: ${names})`);
}
