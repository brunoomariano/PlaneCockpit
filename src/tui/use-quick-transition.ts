import { useCallback, useState } from "react";
import type { Issue } from "../types/issue.js";
import type { Project } from "../types/project.js";
import type { ViewDefinition } from "../types/views.js";
import type { AppContext } from "../app.js";
import type { FileLogger } from "../utils/file-logger.js";
import type { InkKey } from "../keybindings/key-spec.js";
import { neighbourState } from "../plane/state-order.js";
import { patchTouchesViewFilter } from "./view-filter-reconcile.js";

// PendingTransition is a quick state move awaiting y/n confirmation: the issue,
// the resolved target state, and whether the API call is in flight.
interface PendingTransition {
  issue: Issue;
  targetId: string;
  targetName: string;
  fromName: string;
  saving: boolean;
}

export interface UseQuickTransitionOptions {
  // The selected issue (already filtered) the transition acts on, or undefined.
  target: Issue | undefined;
  activeView: ViewDefinition | undefined;
  ctx: AppContext;
  logger: FileLogger;
  // setMessage surfaces hints and errors in the status bar.
  setMessage: (message: string) => void;
  // reconcile applies the committed move: refresh when the move can change view
  // membership, otherwise patch the row in place.
  reconcile: (updated: Issue, touchesFilter: boolean) => void;
}

export interface UseQuickTransition {
  // The move awaiting confirmation, or undefined when none is pending.
  pending: PendingTransition | undefined;
  // True while a transition confirmation is showing (consumes y/n keys).
  active: boolean;
  // start resolves the neighbour state one step in `direction` and opens the
  // confirmation; a no-op at the ends shows a hint instead of erroring.
  start: (direction: 1 | -1) => Promise<void>;
  // handleKey gates the pending move on y/enter (apply) or n/escape (cancel).
  handleKey: (input: string, key: InkKey) => void;
}

function projectOf(issue: Issue): Project {
  return { id: issue.project_id, identifier: issue.project_identifier, name: "", workspace_id: "" };
}

// useQuickTransition owns the `>` / `<` quick state transition: resolving the
// neighbour state, the y/n confirmation, and committing the move with one
// issues.update. The commit reconciles the row the same way the edit modal does
// (refresh when the move can change view membership, else patch in place).
export function useQuickTransition(opts: UseQuickTransitionOptions): UseQuickTransition {
  const { target, activeView, ctx, logger, setMessage, reconcile } = opts;
  const [pending, setPending] = useState<PendingTransition | undefined>();

  const start = useCallback(
    async (direction: 1 | -1) => {
      const issue = target;
      if (!issue) return;
      try {
        const states = await ctx.states.list(projectOf(issue));
        const next = neighbourState(states, issue.state.id, direction);
        if (!next) {
          setMessage(`${issue.key}: already at the ${direction === 1 ? "last" : "first"} state`);
          return;
        }
        setPending({
          issue,
          targetId: next.id,
          targetName: next.name,
          fromName: issue.state.name,
          saving: false,
        });
      } catch (err) {
        logger.error("state transition load failed", { issue: issue.key, err: err as Error });
        setMessage(`${issue.key}: ${(err as Error).message}`);
      }
    },
    [target, ctx, logger, setMessage],
  );

  const apply = useCallback(async () => {
    const current = pending;
    if (!current) return;
    setPending({ ...current, saving: true });
    try {
      const patch = { state_id: current.targetId };
      const updated = await ctx.issues.update(current.issue.key, patch);
      setMessage(`${current.issue.key} → ${current.targetName}`);
      reconcile(updated, patchTouchesViewFilter(patch, activeView?.filters));
    } catch (err) {
      logger.error("state transition failed", { issue: current.issue.key, err: err as Error });
      setMessage(`${current.issue.key}: ${(err as Error).message}`);
    } finally {
      setPending(undefined);
    }
  }, [pending, ctx, activeView, logger, setMessage, reconcile]);

  const handleKey = (input: string, key: InkKey): void => {
    if (pending?.saving) return;
    if (input === "y" || key.return) return void apply();
    if (input === "n" || key.escape) setPending(undefined);
  };

  return { pending, active: pending !== undefined, start, handleKey };
}
