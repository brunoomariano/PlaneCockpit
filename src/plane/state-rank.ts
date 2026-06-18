import type { IssueState, IssueStateGroup } from "../types/issue.js";

// Workflow lifecycle order, used as the fallback when a state's slug is not
// listed in `state_order`. Mirrors the group progression backlog → … →
// cancelled, with cancelled as the terminal off-ramp.
const STATE_GROUP_RANK: Record<IssueStateGroup, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  cancelled: 4,
};

// Listed states always sort before unlisted ones. An unlisted state's rank is
// offset past every possible listed rank so the two buckets never interleave.
const UNLISTED_OFFSET = 1_000_000;

/**
 * normalizeStateSlug folds a state name into the slug used to match `state_order`
 * entries: lowercased, trimmed, with internal whitespace runs collapsed to a
 * single space. So "In  Progress ", "in progress", and "IN PROGRESS" all match
 * the configured slug "in progress", sidestepping case/spacing mistakes.
 */
export function normalizeStateSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * StateRank assigns a sortable rank to a state. Lower ranks sort first.
 */
export type StateRank = (state: IssueState) => number;

/**
 * buildStateRank turns an optional `state_order` slug list into a rank function.
 *
 * A listed slug ranks by its position (0, 1, 2, …), so the declared order wins.
 * A state whose normalized name is not listed ranks after every listed state,
 * tie-broken by its workflow group (backlog → … → cancelled) — the groups are
 * fixed, so unlisted states keep a sensible lifecycle order among themselves.
 * With no `state_order` (or an empty one) every state falls back to group rank,
 * preserving the previous behaviour.
 */
export function buildStateRank(stateOrder: string[] | undefined): StateRank {
  const position = new Map<string, number>();
  (stateOrder ?? []).forEach((slug, index) => {
    const normalized = normalizeStateSlug(slug);
    // First occurrence wins; a duplicate slug does not shift the earlier rank.
    if (!position.has(normalized)) position.set(normalized, index);
  });

  return (state) => {
    const listed = position.get(normalizeStateSlug(state.name));
    if (listed !== undefined) return listed;
    return UNLISTED_OFFSET + STATE_GROUP_RANK[state.group];
  };
}
