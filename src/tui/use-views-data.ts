import { useCallback, useMemo, useRef, useState } from "react";
import type { Issue } from "../types/issue.js";
import type { ViewDefinition } from "../types/views.js";
import type { SortKey } from "../types/views.js";
import type { IssuesService } from "../plane/issues.js";
import type { FileLogger } from "../utils/file-logger.js";
import { resolveViewProjectsLenient } from "../config/resolve-view-projects.js";
import { mapWithConcurrency } from "../utils/async.js";

// Caps how many views refreshAll fetches at once, so the 'R' (refresh all) burst
// does not overwhelm a slow self-hosted Plane and trip request timeouts.
const REFRESH_ALL_CONCURRENCY = 3;

// Per-view fetch state. `issues` holds the last successful result; it is kept
// across refreshes so the list and the navbar count stay visible while a new
// fetch is in flight (the skeleton only shows before the first successful load).
// `loaded` flips true once a fetch has completed at least once, so the navbar
// can tell "never loaded" (show nothing/loading) from "loaded, currently zero".
export interface ViewData {
  issues: Issue[];
  loading: boolean;
  error: string | undefined;
  loaded: boolean;
  // Identifiers of the view's projects whose fetch failed on the last load. A
  // non-empty list means the rows are a *partial* result (some projects timed
  // out / errored), which the dashboard surfaces as a degraded view rather than
  // a clean empty one.
  failedProjects: string[];
}

const EMPTY_VIEW_DATA: ViewData = {
  issues: [],
  loading: false,
  error: undefined,
  loaded: false,
  failedProjects: [],
};

// ViewsData is what the dashboard consumes: the per-view slices plus the loaders.
export interface ViewsData {
  // One entry per configured view, index-aligned with the views array.
  byView: ViewData[];
  // Loads a single view, keeping the existing rows visible until the new data
  // arrives (the navbar swaps its count for a spinner meanwhile). Returns the
  // loaded issues' keys so the caller can re-anchor the cursor.
  load: (viewIdx: number) => Promise<string[]>;
  // Refreshes every view at once (the 'R' keybinding), preserving current rows.
  refreshAll: () => void;
  // Replaces the row with the same key in a view's rows with `updated`, so a
  // successful edit reflects immediately without refetching the whole view
  // (selection/scroll are preserved because the row identity is unchanged). A
  // no-op when the view has no row with that key.
  patchIssue: (viewIdx: number, updated: Issue) => void;
}

interface UseViewsDataOptions {
  views: ViewDefinition[];
  issuesService: IssuesService;
  defaultProjects: string[] | undefined;
  defaultsSort: SortKey[] | undefined;
  logger: FileLogger;
}

// useViewsData owns the per-view fetch lifecycle so the dashboard does not have
// to. Holding the data here (rather than a single active-view slice) is what
// lets the navbar show a live count per view and lets a view switch reuse the
// previous result instead of flashing a skeleton.
export function useViewsData(opts: UseViewsDataOptions): ViewsData {
  const { views, issuesService, defaultProjects, defaultsSort, logger } = opts;
  const [byView, setByView] = useState<ViewData[]>(() => views.map(() => EMPTY_VIEW_DATA));

  // Keep the latest views in a ref so refreshAll can iterate without becoming a
  // new function on every render (which would restart the dashboard's effects).
  const viewsRef = useRef(views);
  viewsRef.current = views;

  // One in-flight AbortController per view index. Starting a new fetch for a view
  // aborts the previous one, so overlapping refreshes (auto-refresh tick landing
  // on top of a still-pending fetch, or a manual 'r') collapse to the latest
  // request instead of piling up open connections until they time out.
  const inflightRef = useRef<Map<number, AbortController>>(new Map());

  const patch = useCallback((idx: number, next: Partial<ViewData>) => {
    setByView((prev) => {
      const copy = [...prev];
      copy[idx] = { ...(copy[idx] ?? EMPTY_VIEW_DATA), ...next };
      return copy;
    });
  }, []);

  const load = useCallback(
    async (viewIdx: number): Promise<string[]> => {
      const view = viewsRef.current[viewIdx];
      if (!view) {
        logger.warn("no view to load at index", { viewIdx });
        return [];
      }
      // Mark loading without touching `issues`: the navbar swaps the count for a
      // spinner and the list keeps the previous rows until new data arrives.
      patch(viewIdx, { loading: true, error: undefined });

      const { projects, invalid } = resolveViewProjectsLenient(view, defaultProjects);
      if (invalid.length > 0) {
        logger.warn("view references projects outside defaults.projects (ignored)", {
          view: view.name,
          invalid,
        });
      }
      if (projects.length === 0) {
        // Every declared project is invalid: nothing to load. The navbar already
        // shows the error marker; mark the view loaded-but-empty.
        logger.warn("view resolved to no valid projects", { view: view.name });
        patch(viewIdx, { loading: false, issues: [], loaded: true, failedProjects: [] });
        return [];
      }

      // Abort any still-pending fetch for this view, then register ours so a
      // later fetch can abort it in turn.
      inflightRef.current.get(viewIdx)?.abort(new Error("superseded"));
      const controller = new AbortController();
      inflightRef.current.set(viewIdx, controller);

      try {
        logger.debug("loading view", { view: view.name, projects });
        // Resilient fetch: a single project timing out leaves the others
        // visible. failedProjects marks the view as partial (degraded) instead
        // of empty; the per-project errors are already logged by the API trace.
        const { issues: data, failedProjects } = await issuesService.listResilient(
          projects,
          view,
          view.query_limit ?? 100,
          defaultsSort,
          controller.signal,
        );
        patch(viewIdx, {
          loading: false,
          issues: data,
          loaded: true,
          error: undefined,
          failedProjects,
        });
        if (failedProjects.length > 0) {
          logger.warn("view loaded with partial failures", {
            view: view.name,
            failedProjects,
          });
        }
        logger.debug("view loaded", { view: view.name, count: data.length });
        return data.map((i) => i.key);
      } catch (err) {
        // A superseded fetch lost the race to a newer one: that newer fetch owns
        // the view's state now, so leave loading/error untouched and stay quiet.
        if (controller.signal.aborted) {
          logger.debug("view load aborted (superseded)", { view: view.name });
          return [];
        }
        const message = (err as Error).message;
        // Preserve the previous rows on a failed refresh; only surface the error.
        patch(viewIdx, { loading: false, error: message });
        logger.error("view load failed", { view: view.name, err: err as Error });
        return [];
      } finally {
        // Clear the registry only if it still points at our controller; a newer
        // fetch may have already replaced it.
        if (inflightRef.current.get(viewIdx) === controller) {
          inflightRef.current.delete(viewIdx);
        }
      }
    },
    [issuesService, defaultProjects, defaultsSort, logger, patch],
  );

  const refreshAll = useCallback(() => {
    const indices = viewsRef.current.map((_, idx) => idx);
    // Throttle the fan-out to a few views at a time instead of firing every
    // view's fetch at once (which timed out against a slow self-hosted Plane).
    void mapWithConcurrency(indices, REFRESH_ALL_CONCURRENCY, (idx) => load(idx));
  }, [load]);

  const patchIssue = useCallback((viewIdx: number, updated: Issue) => {
    setByView((prev) => {
      const current = prev[viewIdx];
      if (!current) return prev;
      const idx = current.issues.findIndex((i) => i.key === updated.key);
      if (idx < 0) return prev;
      const issues = [...current.issues];
      issues[idx] = updated;
      const copy = [...prev];
      copy[viewIdx] = { ...current, issues };
      return copy;
    });
  }, []);

  return useMemo(
    () => ({ byView, load, refreshAll, patchIssue }),
    [byView, load, refreshAll, patchIssue],
  );
}
