import { useEffect, useMemo, useState } from "react";
import type { Issue } from "../types/issue.js";
import type { IssueActivity } from "../types/activity.js";
import type { IssueRelation } from "../types/relation.js";
import type { DetailTarget } from "./use-detail-stack.js";
import { buildRelations } from "../plane/relation-view.js";
import type { AppContext } from "../app.js";
import type { FileLogger } from "../utils/file-logger.js";

export interface UseRelationsOptions {
  // True while the detail panel is open; gates the fetch.
  open: boolean;
  // The active target whose relations to load, or undefined.
  target: DetailTarget | undefined;
  // The activity log from useActivityLog, reused for the related_at/key join so
  // the relations view does not fetch the log a second time.
  activities: IssueActivity[] | undefined;
  ctx: AppContext;
  logger: FileLogger;
}

export interface UseRelations {
  // Current relations (display-ordered), each enriched with key/related_at from
  // the log and, once resolved, the target issue (name/state). Empty until load.
  relations: IssueRelation[];
  // True while the relations fetch is in flight.
  loading: boolean;
}

// useRelations loads the selected issue's current relations when the detail panel
// opens, joins them with the activity log for the key/related_at, and then
// lazily resolves each target issue (name/state) for display and navigation.
// Like the activity log it runs in its own effect and degrades silently on
// failure: the relations fetch never blocks the description, and a target that
// fails to resolve simply shows without its name/state.
export function useRelations(opts: UseRelationsOptions): UseRelations {
  const { open, target, activities, ctx, logger } = opts;
  const [relations, setRelations] = useState<IssueRelation[] | undefined>();
  const [loading, setLoading] = useState(false);
  // Resolved target issues keyed by their human-readable key, filled in as the
  // per-relation retrieves settle. Kept separate from `relations` so a re-join
  // (when the log arrives after the relations) does not drop enrichment.
  const [targets, setTargets] = useState<Record<string, Issue>>({});

  useEffect(() => {
    if (!open || !target) {
      setRelations(undefined);
      setTargets({});
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
    ctx.relations
      .list(project, target.id, controller.signal)
      .then((current) => {
        if (!controller.signal.aborted) setRelations(buildRelations(current, activities ?? []));
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        logger.warn("relations fetch failed", { issue: target.key, err });
        setRelations(undefined);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
    // Re-run when the activities arrive so the key/related_at join is applied
    // even if the log resolves after the relations.
  }, [open, target, activities, ctx, logger]);

  // Lazily resolve each related issue (name/state) by its key. ctx.issues.view
  // resolves the project from the key and retrieves cross-project, all cached, so
  // reopening the same relation is cheap. Best-effort: a failure leaves the row
  // without its name/state rather than erroring the section.
  useEffect(() => {
    if (!relations) return;
    let cancelled = false;
    const pending = relations
      .map((r) => r.targetKey)
      .filter((key): key is string => Boolean(key) && !(key! in targets));
    for (const key of pending) {
      ctx.issues
        .view(key)
        .then((issue) => {
          if (!cancelled) setTargets((prev) => ({ ...prev, [key]: issue }));
        })
        .catch((err: Error) => {
          logger.warn("relation target resolve failed", { key, err });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [relations, targets, ctx, logger]);

  const enriched = useMemo(
    () =>
      (relations ?? []).map((r) =>
        r.targetKey && targets[r.targetKey] ? { ...r, target: targets[r.targetKey] } : r,
      ),
    [relations, targets],
  );

  return { relations: enriched, loading };
}
