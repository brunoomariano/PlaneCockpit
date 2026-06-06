import { useEffect, useState } from "react";
import type { Issue } from "../types/issue.js";
import type { AppContext } from "../app.js";
import type { FileLogger } from "../utils/file-logger.js";

export interface UseDetailPanelOptions {
  // True while the detail panel is the active mode; gates the retrieve.
  open: boolean;
  // The selected list row whose full issue the panel shows, or undefined.
  target: Issue | undefined;
  ctx: AppContext;
  logger: FileLogger;
  // setMessage surfaces a retrieve error in the status bar.
  setMessage: (message: string) => void;
}

export interface UseDetailPanel {
  // The full issue (with description) once retrieved, else undefined.
  detailed: Issue | undefined;
  // True while the retrieve is in flight.
  loading: boolean;
  // Current scroll offset (rows) into the description region.
  scroll: number;
  // Scroll actions; `by` moves by a page (clamped at 0), top/bottom jump.
  scrollBy: (rows: number) => void;
  scrollTop: () => void;
  scrollBottom: () => void;
}

// useDetailPanel owns the issue detail view's data and scroll position. The list
// endpoint omits description_*, so when the panel opens it retrieves the full
// issue once; the description scroll resets per issue. State and the fetch live
// here; the key dispatch stays in the dashboard, which interleaves detail keys
// with the global actions and calls the scroll actions exposed here.
export function useDetailPanel(opts: UseDetailPanelOptions): UseDetailPanel {
  const { open, target, ctx, logger, setMessage } = opts;
  const [detailed, setDetailed] = useState<Issue | undefined>();
  const [loading, setLoading] = useState(false);
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    if (!open || !target) {
      setDetailed(undefined);
      return;
    }
    // Reset the description scroll each time a new issue's detail opens so the
    // user starts at the top instead of carrying the previous position.
    setScroll(0);
    let cancelled = false;
    setLoading(true);
    const project = {
      id: target.project_id,
      identifier: target.project_identifier,
      name: "",
      workspace_id: "",
    };
    ctx.workItems
      .retrieve(project, target.id)
      .then((full) => {
        if (!cancelled) setDetailed(full);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        logger.error("retrieve issue failed", { issue: target.key, err });
        setMessage(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, target, ctx, logger, setMessage]);

  return {
    detailed,
    loading,
    scroll,
    scrollBy: (rows) => setScroll((s) => Math.max(0, s + rows)),
    scrollTop: () => setScroll(0),
    scrollBottom: () => setScroll(Number.MAX_SAFE_INTEGER),
  };
}
