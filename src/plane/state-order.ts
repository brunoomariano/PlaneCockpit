import type { IssueState, IssueStateGroup } from "../types/issue.js";

// The workflow progression order of state groups. "Forward" moves an issue along
// this lifecycle (backlog → … → completed), with cancelled last as a terminal
// off-ramp. States within the same group keep the order the API returned them.
const GROUP_ORDER: IssueStateGroup[] = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
];

// orderStates returns the states sorted into workflow order: by group lifecycle,
// then by their original index within a group (a stable sort preserves it). This
// is the order the quick-transition bindings step through.
export function orderStates(states: IssueState[]): IssueState[] {
  return states
    .map((state, index) => ({ state, index }))
    .sort((a, b) => {
      const ga = GROUP_ORDER.indexOf(a.state.group);
      const gb = GROUP_ORDER.indexOf(b.state.group);
      if (ga !== gb) return ga - gb;
      return a.index - b.index;
    })
    .map((entry) => entry.state);
}

// neighbourState returns the state one step forward (+1) or backward (-1) from
// `currentId` in workflow order, or undefined when there is no neighbour (the
// current state is at the matching end, or is not among the project's states).
// A no-op at the ends lets the caller show a hint instead of wrapping around.
export function neighbourState(
  states: IssueState[],
  currentId: string,
  direction: 1 | -1,
): IssueState | undefined {
  const ordered = orderStates(states);
  const idx = ordered.findIndex((s) => s.id === currentId);
  if (idx < 0) return undefined;
  const target = idx + direction;
  if (target < 0 || target >= ordered.length) return undefined;
  return ordered[target];
}
