import type { IssueState } from "../types/issue.js";
import { buildStateRank } from "./state-rank.js";

// orderStates returns the states sorted into workflow order: by the configured
// `state_order` (listed slugs first, in declared order), then unlisted states by
// group lifecycle, with ties broken by their original index (a stable sort
// preserves it). This is the order the quick-transition bindings step through,
// so `n`/`p` follow the same sequence the user declares for `sort: state`.
export function orderStates(states: IssueState[], stateOrder?: string[]): IssueState[] {
  const rank = buildStateRank(stateOrder);
  return states
    .map((state, index) => ({ state, index }))
    .sort((a, b) => {
      const ra = rank(a.state);
      const rb = rank(b.state);
      if (ra !== rb) return ra - rb;
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
  stateOrder?: string[],
): IssueState | undefined {
  const ordered = orderStates(states, stateOrder);
  const idx = ordered.findIndex((s) => s.id === currentId);
  if (idx < 0) return undefined;
  const target = idx + direction;
  if (target < 0 || target >= ordered.length) return undefined;
  return ordered[target];
}
