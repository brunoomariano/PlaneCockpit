import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import type { Issue } from "../types/issue.js";
import type { AppContext } from "../app.js";
import { StatusBar } from "./status-bar.js";
import { ViewSelector, SIDE_PANEL_WIDTH } from "./view-selector.js";
import { IssueList } from "./issue-list.js";
import { IssueDetail, DETAIL_CHROME_ROWS } from "./issue-detail.js";
import { FilterBox } from "./filter-box.js";
import { HelpModal } from "./help-modal.js";
import { buildIssueUrl } from "../utils/urls.js";
import { defaultBrowserOpener } from "../utils/browser.js";
import type { FileLogger } from "../utils/file-logger.js";
import { dispatch } from "../keybindings/dispatcher.js";
import { resolveViewProjectsLenient, buildViewEntries } from "../config/resolve-view-projects.js";
import type { ActionId } from "../keybindings/registry.js";
import type { InkKey } from "../keybindings/key-spec.js";

export interface DashboardProps {
  ctx: AppContext;
  logger: FileLogger;
}

type Panel = "list" | "detail";

// Below this width the fixed side panel (SIDE_PANEL_WIDTH) leaves too little room
// for a readable issue table beside it, so the layout stacks the views panel on
// top instead. Set above SIDE_PANEL_WIDTH + a usable table so the side-by-side
// layout only stays while the list still has real space.
export const NARROW_BREAKPOINT = 100;

// isNarrowLayout decides whether the dashboard stacks the views panel on top
// (true) or keeps it as a left column (false), based on terminal width.
export function isNarrowLayout(columns: number): boolean {
  return columns < NARROW_BREAKPOINT;
}

// listViewportRows computes how many issue rows fit, reserving space for the
// status bar, list header/border, the optional filter box and "N more" hints,
// and the stacked views panel in narrow layout (4 rows: 2 content + 2 border).
// Floored at 3 so the list never collapses entirely on a tiny terminal.
export function listViewportRows(opts: {
  terminalRows: number;
  filtering: boolean;
  hasFilter: boolean;
  narrow: boolean;
}): number {
  const reserved = 9 + (opts.filtering ? 3 : 0) + (opts.hasFilter ? 1 : 0) + (opts.narrow ? 4 : 0);
  return Math.max(3, opts.terminalRows - reserved);
}

export function Dashboard({ ctx, logger }: DashboardProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = useState(stdout?.rows ?? 24);
  const [terminalCols, setTerminalCols] = useState(stdout?.columns ?? 80);
  useEffect(() => {
    if (!stdout) return;
    const onResize = (): void => {
      setTerminalRows(stdout.rows ?? 24);
      setTerminalCols(stdout.columns ?? 80);
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const narrow = isNarrowLayout(terminalCols);

  const views = useMemo(() => ctx.runtime.profile.views ?? [], [ctx]);
  const defaultProjects = useMemo(() => ctx.runtime.profile.defaults?.projects ?? [], [ctx]);
  // Resolve each view once to feed the navbar markers: '#' when it restricts
  // projects, '*' when it references projects outside defaults.projects.
  const viewEntries = useMemo(
    () => buildViewEntries(views, defaultProjects),
    [views, defaultProjects],
  );
  const [viewIdx, setViewIdx] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [filtering, setFiltering] = useState(false);
  const [filter, setFilter] = useState("");
  const [panel, setPanel] = useState<Panel>("list");
  const [helpOpen, setHelpOpen] = useState(false);
  // detailed holds the full issue (with description) fetched via retrieve(). It
  // resets when the selection changes; we keep one entry at a time because the
  // detail panel only shows one issue.
  const [detailed, setDetailed] = useState<Issue | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailScroll, setDetailScroll] = useState(0);

  const activeView = views[viewIdx];

  const load = useCallback(async () => {
    if (!activeView) {
      logger.warn("no active view to load (profile has no views configured)");
      return;
    }
    setLoading(true);
    setError(undefined);
    // Clear the previous list so the user sees the skeleton appear immediately
    // rather than stale rows from a different view.
    setIssues([]);
    setSelected(0);
    try {
      // Lenient resolution: a view's invalid projects are ignored (and flagged
      // in the navbar with '*') instead of crashing the dashboard.
      const { projects, invalid } = resolveViewProjectsLenient(
        activeView,
        ctx.runtime.profile.defaults?.projects,
      );
      if (invalid.length > 0) {
        logger.warn("view references projects outside defaults.projects (ignored)", {
          view: activeView.name,
          invalid,
        });
      }
      if (projects.length === 0) {
        // Every declared project is invalid: nothing to load. The navbar already
        // shows the error marker; we keep the list empty.
        logger.warn("view resolved to no valid projects", { view: activeView.name });
        return;
      }
      logger.debug("loading view", { view: activeView.name, projects });
      const data = await ctx.issues.list(projects, activeView, activeView.query_limit ?? 100);
      setIssues(data);
      setSelected(0);
      logger.debug("view loaded", { view: activeView.name, count: data.length });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      logger.error("view load failed", { view: activeView.name, err: err as Error });
    } finally {
      setLoading(false);
    }
  }, [ctx, activeView, logger]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    logger.info("dashboard started", {
      profile: ctx.runtime.profile_name,
      workspace: ctx.runtime.profile.server.workspace_slug,
      views: views.length,
    });
    if (views.length === 0) {
      setError("no views configured — add `views:` to your profile in config.yaml");
    }
  }, [ctx, views, logger]);

  const filtered = useMemo(() => {
    if (!filter) return issues;
    const needle = filter.toLowerCase();
    return issues.filter(
      (i) => i.name.toLowerCase().includes(needle) || i.key.toLowerCase().includes(needle),
    );
  }, [issues, filter]);

  const currentSummary = filtered[selected];

  // Fetch full issue (with description) only when the detail panel is visible.
  // The list endpoint omits description_*, so the body needs an extra retrieve.
  useEffect(() => {
    if (panel !== "detail" || !currentSummary) {
      setDetailed(undefined);
      return;
    }
    // Each time a new issue's detail opens, reset the description scroll so the
    // user starts at the top instead of carrying the previous scroll position.
    setDetailScroll(0);
    let cancelled = false;
    setDetailLoading(true);
    const project = {
      id: currentSummary.project_id,
      identifier: currentSummary.project_identifier,
      name: "",
      workspace_id: "",
    };
    ctx.workItems
      .retrieve(project, currentSummary.id)
      .then((full) => {
        if (cancelled) return;
        setDetailed(full);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        logger.error("retrieve issue failed", { issue: currentSummary.key, err });
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [panel, currentSummary, ctx, logger]);

  const viewportRows = listViewportRows({
    terminalRows,
    filtering,
    hasFilter: Boolean(filter),
    narrow,
  });

  // Detail modal viewport. The modal box itself is sized to fill the terminal
  // minus the status bar, and the description region inside it gets whatever is
  // left after the chrome (header + meta + paddings + hints).
  const STATUS_BAR_ROWS = 3;
  const detailModalHeight = Math.max(DETAIL_CHROME_ROWS + 3, terminalRows - STATUS_BAR_ROWS);
  const detailViewportRows = Math.max(3, detailModalHeight - DETAIL_CHROME_ROWS);

  const openSelectedInBrowser = useCallback(() => {
    const issue = filtered[selected];
    if (!issue) return;
    try {
      const url = buildIssueUrl(ctx.runtime.profile.server, {
        id: issue.id,
        project_id: issue.project_id,
      });
      void defaultBrowserOpener.open(url).catch((err) => {
        logger.error("failed to open browser", { url, err: err as Error });
      });
    } catch (err) {
      logger.error("failed to build issue url", { issue: issue.key, err: err as Error });
      setError((err as Error).message);
    }
  }, [filtered, selected, ctx, logger]);

  const selectNext = (): void => setSelected((s) => Math.min(filtered.length - 1, s + 1));
  const selectPrev = (): void => setSelected((s) => Math.max(0, s - 1));
  const viewNext = (): void => setViewIdx((i) => Math.min(views.length - 1, i + 1));
  const viewPrev = (): void => setViewIdx((i) => Math.max(0, i - 1));

  const handlers: Partial<Record<ActionId, () => void>> = {
    "global.quit": () => exit(),
    "global.refresh": () => void load(),
    "global.help": () => setHelpOpen((open) => !open),
    "list.next": selectNext,
    "list.next-alt": selectNext,
    "list.prev": selectPrev,
    "list.prev-alt": selectPrev,
    "list.page-down": () => setSelected((s) => Math.min(filtered.length - 1, s + viewportRows)),
    "list.page-up": () => setSelected((s) => Math.max(0, s - viewportRows)),
    "list.top": () => setSelected(0),
    "list.bottom": () => setSelected(Math.max(0, filtered.length - 1)),
    "list.open-detail": () => setPanel("detail"),
    "list.open-browser": openSelectedInBrowser,
    "view.next": viewNext,
    "view.next-alt": viewNext,
    "view.prev": viewPrev,
    "view.prev-alt": viewPrev,
    "filter.start": () => {
      setFilter("");
      setFiltering(true);
    },
  };

  // Input routing is split per active context (help modal, detail modal, filter
  // box, list) so each path stays small. Each handler consumes the keystroke for
  // its context; the top-level callback just dispatches to the active one.
  const handleHelpKey = (input: string, key: InkKey): void => {
    const consumed = dispatch(
      ctx.keybindings,
      ["help"],
      { "help.close": () => setHelpOpen(false) },
      input,
      key,
    );
    if (!consumed && (input === "q" || key.escape)) setHelpOpen(false);
  };

  const handleDetailKey = (input: string, key: InkKey): void => {
    const scrollDown = (): void => setDetailScroll((s) => s + 1);
    const scrollUp = (): void => setDetailScroll((s) => Math.max(0, s - 1));
    const detailHandlers: Partial<Record<ActionId, () => void>> = {
      "detail.close": () => setPanel("list"),
      "detail.scroll-down": scrollDown,
      "detail.scroll-down-alt": scrollDown,
      "detail.scroll-up": scrollUp,
      "detail.scroll-up-alt": scrollUp,
      "detail.page-down": () => setDetailScroll((s) => s + detailViewportRows),
      "detail.page-up": () => setDetailScroll((s) => Math.max(0, s - detailViewportRows)),
      "detail.top": () => setDetailScroll(0),
      "detail.bottom": () => setDetailScroll(Number.MAX_SAFE_INTEGER),
      "detail.open-browser": openSelectedInBrowser,
      "global.help": () => setHelpOpen((open) => !open),
      "global.refresh": () => void load(),
      "global.quit": () => setPanel("list"),
    };
    dispatch(ctx.keybindings, ["detail", "global"], detailHandlers, input, key);
  };

  const handleFilterKey = (input: string, key: InkKey): void => {
    if (key.return || key.escape) {
      setFiltering(false);
    } else if (key.backspace || key.delete) {
      setFilter((f) => f.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setFilter((f) => f + input);
    }
  };

  useInput((input, key) => {
    if (helpOpen) return handleHelpKey(input, key);
    if (panel === "detail") return handleDetailKey(input, key);
    if (filtering) return handleFilterKey(input, key);
    dispatch(ctx.keybindings, ["global", "list", "view", "filter"], handlers, input, key);
  });

  const current = detailed ?? currentSummary;

  // Shared status-bar props. profile/workspace/view are identical across panels;
  // loading and position vary slightly per panel and are passed at each call.
  const statusBarBase = {
    profile: ctx.runtime.profile_name,
    workspace: ctx.runtime.profile.server.workspace_slug,
    view: activeView?.name ?? "—",
    message: error,
  };
  const listPosition = filtered.length > 0 ? `${selected + 1}/${filtered.length}` : undefined;

  if (helpOpen) {
    // Ink has no absolute positioning, so the modal effect is achieved by replacing
    // the main content with a centered, bordered HelpModal that fills the terminal.
    return (
      <Box flexDirection="column" height={terminalRows}>
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <HelpModal bindings={ctx.keybindings} onClose={() => setHelpOpen(false)} />
        </Box>
        <StatusBar {...statusBarBase} loading={loading} position={listPosition} />
      </Box>
    );
  }

  if (panel === "detail") {
    return (
      <Box flexDirection="column" height={terminalRows}>
        <Box flexGrow={1} justifyContent="center" alignItems="flex-start" overflow="hidden">
          <IssueDetail
            issue={current}
            loading={detailLoading}
            variant="modal"
            scrollTop={detailScroll}
            viewportRows={detailViewportRows}
            height={detailModalHeight}
          />
        </Box>
        <StatusBar
          {...statusBarBase}
          loading={detailLoading}
          position={current ? listPosition : undefined}
        />
      </Box>
    );
  }

  return (
    <ListLayout
      narrow={narrow}
      height={terminalRows}
      width={terminalCols}
      defaultProjects={defaultProjects}
      viewEntries={viewEntries}
      viewIdx={viewIdx}
      issues={filtered}
      selected={selected}
      filter={filter}
      filtering={filtering}
      viewportRows={viewportRows}
      loading={loading}
      statusBar={<StatusBar {...statusBarBase} loading={loading} position={listPosition} />}
    />
  );
}

interface ListLayoutProps {
  narrow: boolean;
  // height bounds the whole layout to the terminal so content taller than the
  // screen clips inside the (scrollable) list region instead of pushing the
  // views bar and column header off the top of the terminal.
  height: number;
  // width (terminal columns) drives the responsive issue-list column widths.
  width: number;
  defaultProjects: string[];
  viewEntries: ReturnType<typeof buildViewEntries>;
  viewIdx: number;
  issues: Issue[];
  selected: number;
  filter: string;
  filtering: boolean;
  viewportRows: number;
  loading: boolean;
  statusBar: React.ReactNode;
}

// ListLayout arranges the views panel and the issue list. Wide terminals place
// the views panel as a left column; narrow ones stack it on top (controlled by
// `narrow`). The container is pinned to the terminal height with overflow hidden
// so the fixed views bar / column header never scroll out of view.
function ListLayout(props: ListLayoutProps): React.ReactElement {
  return (
    <Box flexDirection="column" height={props.height} overflow="hidden">
      {/* Wide: views panel beside the list (row). Narrow: stacked on top (column). */}
      <Box flexDirection={props.narrow ? "column" : "row"} flexGrow={1} overflow="hidden">
        <ViewSelector
          defaultProjects={props.defaultProjects}
          views={props.viewEntries}
          active={props.viewIdx}
          horizontal={props.narrow}
        />
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          <IssueList
            issues={props.issues}
            selected={props.selected}
            filter={props.filter}
            viewportRows={props.viewportRows}
            // Wide layout: the side panel takes SIDE_PANEL_WIDTH columns, so the
            // list only has the remainder. Narrow layout: panel is on top, list
            // gets the full width.
            width={props.narrow ? props.width : props.width - SIDE_PANEL_WIDTH}
            loading={props.loading}
          />
          <FilterBox active={props.filtering} value={props.filter} />
        </Box>
      </Box>
      {props.statusBar}
    </Box>
  );
}
