import { useEffect, useMemo, useState } from "react";
import type { Issue } from "../types/issue.js";
import type { IssueActivity } from "../types/activity.js";
import { isStateChange } from "../types/activity.js";
import { timeInCurrentState } from "../plane/state-duration.js";
import { humanizeDuration } from "../utils/format-duration.js";
import type { AppContext } from "../app.js";
import type { FileLogger } from "../utils/file-logger.js";

export interface UseActivityLogOptions {
  // True while the detail panel is open; gates the fetch.
  open: boolean;
  // The issue whose activity log to load, or undefined.
  target: Issue | undefined;
  ctx: AppContext;
  logger: FileLogger;
}

export interface UseActivityLog {
  // State-change events only (oldest→newest), the activity tab's content.
  stateChanges: IssueActivity[];
  // True while the log fetch is in flight.
  loading: boolean;
  // Humanized "time in current state" (e.g. "3d 4h"), or undefined when the log
  // has not loaded yet or failed — the caller then simply omits the line.
  timeInState: string | undefined;
}

// useActivityLog loads the selected issue's activity log when the detail panel
// opens, deriving the "time in current state" line and the state-change list.
// It runs in its OWN effect, separate from useDetailPanel's description fetch, so
// a slow or failing activity request never blocks or delays the description the
// user came to read. On error it logs and yields no timing/list — the detail view
// degrades to exactly what it showed before, rather than surfacing an error.
export function useActivityLog(opts: UseActivityLogOptions): UseActivityLog {
  const { open, target, ctx, logger } = opts;
  const [activities, setActivities] = useState<IssueActivity[] | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !target) {
      setActivities(undefined);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const project = {
      id: target.project_id,
      identifier: target.project_identifier,
      name: "",
      workspace_id: "",
    };
    ctx.activities
      .list(project, target.id, controller.signal)
      .then((log) => {
        if (!controller.signal.aborted) setActivities(log);
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        // Non-fatal: the description and metadata are already on screen. Log the
        // failure and leave the timing line/list empty rather than erroring.
        logger.warn("activity log fetch failed", { issue: target.key, err });
        setActivities(undefined);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [open, target, ctx, logger]);

  const stateChanges = useMemo(
    () => (activities ? activities.filter(isStateChange) : []),
    [activities],
  );

  const timeInState = useMemo(() => {
    if (!activities || !target) return undefined;
    return humanizeDuration(timeInCurrentState(activities, target.created_at, Date.now()));
  }, [activities, target]);

  return { stateChanges, loading, timeInState };
}
