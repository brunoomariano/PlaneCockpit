import { useCallback, useState } from "react";
import type { Issue } from "../types/issue.js";

// DetailTarget is the minimal identity the detail panel needs to fetch and frame
// an issue: enough to retrieve it (project + id) and to label/open it (key,
// identifier). The full issue (description, state, created_at) is retrieved by
// useDetailPanel from this; a pushed relation target starts with only these.
export interface DetailTarget {
  id: string;
  key: string;
  project_id: string;
  project_identifier: string;
}

// targetFromIssue narrows a list Issue to the identity the stack stores.
export function targetFromIssue(issue: Issue): DetailTarget {
  return {
    id: issue.id,
    key: issue.key,
    project_id: issue.project_id,
    project_identifier: issue.project_identifier,
  };
}

export interface UseDetailStack {
  // The active target (top of the stack), or undefined when the panel is closed.
  current: DetailTarget | undefined;
  // True when there is a previous target to go back to (a pushed relation).
  canGoBack: boolean;
  // Open the panel on a target, starting a fresh stack (from the list).
  open: (target: DetailTarget) => void;
  // Push a related target on top, navigating into it without losing the path back.
  push: (target: DetailTarget) => void;
  // Go back one level; closes the panel when popping the last entry.
  pop: () => void;
  // Close the panel and clear the stack.
  close: () => void;
}

// useDetailStack owns the detail panel's navigation stack. Opening from the list
// seeds a single-entry stack; following a relation pushes the target so `esc`
// (pop) returns to the issue you came from, and only closes the panel once the
// last entry is popped. This is what lets the detail navigate into related issues
// — possibly across projects — without losing the way back.
export function useDetailStack(): UseDetailStack {
  const [stack, setStack] = useState<DetailTarget[]>([]);

  const open = useCallback((target: DetailTarget) => setStack([target]), []);
  // Ignore a push onto the same issue already on top, so re-selecting the current
  // issue's self-relation (or a double key) cannot stack duplicates.
  const push = useCallback(
    (target: DetailTarget) => setStack((s) => (s.at(-1)?.id === target.id ? s : [...s, target])),
    [],
  );
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);

  return {
    current: stack.at(-1),
    canGoBack: stack.length > 1,
    open,
    push,
    pop,
    close,
  };
}
