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
import { CommentEditor } from "./comment-editor.js";
import { useCommentEditor } from "./use-comment-editor.js";
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

// restoredSelection decides where the cursor lands after a fetch. On a refresh it
// re-anchors on the previously selected issue key when it is still present; on a
// view switch (no previousKey) or when the item is gone it falls back to the top.
// Keeps the dashboard from jumping to row 0 on every refresh (gh-dash #735).
export function restoredSelection(keys: string[], previousKey: string | undefined): number {
  if (!previousKey) return 0;
  const idx = keys.indexOf(previousKey);
  return idx >= 0 ? idx : 0;
}

// renderOverlay wraps whichever full-screen overlay is active (comment editor,
// help, or detail) in the shared column + status-bar chrome, or returns null when
// none is active. Centralising the three branches here keeps the Dashboard
// component's complexity low and the chrome identical across overlays.
function renderOverlay(opts: {
  content: React.ReactNode | undefined;
  height: number;
  alignTop: boolean;
  padded: boolean;
  statusBar: React.ReactNode;
}): React.ReactElement | null {
  if (!opts.content) return null;
  return (
    <Box flexDirection="column" height={opts.height}>
      <Box
        flexGrow={1}
        justifyContent="center"
        alignItems={opts.alignTop ? "flex-start" : "center"}
        paddingX={opts.padded ? 2 : 0}
        overflow="hidden"
      >
        {opts.content}
      </Box>
      {opts.statusBar}
    </Box>
  );
}

// renderCommentContent builds the comment editor node when an issue is selected.
function renderCommentContent(
  issue: Issue | undefined,
  comments: { buffer: import("./text-buffer.js").TextBuffer; submitting: boolean },
): React.ReactNode | undefined {
  if (!issue) return undefined;
  return (
    <CommentEditor issueKey={issue.key} buffer={comments.buffer} submitting={comments.submitting} />
  );
}

// overlayLoading picks the spinner flag for the active overlay's status bar.
function overlayLoading(
  submittingComment: boolean,
  isDetail: boolean,
  detailLoading: boolean,
  loading: boolean,
): boolean {
  if (submittingComment) return true;
  return isDetail ? detailLoading : loading;
}

// Dashboard wires together state, input routing and the per-mode views. Its
// branch count is inherent to being the single interactive container (list,
// detail, help, comment, filter); splitting it further would scatter the shared
// state and hurt readability, so the complexity cap is waived here — the same
// trade-off the request lifecycle in plane/client.ts makes.
// eslint-disable-next-line complexity
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

  // Tracks the key of the currently selected issue so a refresh can restore the
  // selection on the same item instead of jumping back to the top (gh-dash #735).
  const selectedKeyRef = React.useRef<string | undefined>(undefined);

  const load = useCallback(
    async (preserveSelection = false) => {
      if (!activeView) {
        logger.warn("no active view to load (profile has no views configured)");
        return;
      }
      setLoading(true);
      setError(undefined);
      // On a view switch, clear the list so the skeleton appears immediately and
      // the cursor starts at the top. On a refresh of the same view, keep the
      // rows and the cursor put while the new data loads.
      const previousKey = preserveSelection ? selectedKeyRef.current : undefined;
      if (!preserveSelection) {
        setIssues([]);
        setSelected(0);
      }
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
          if (preserveSelection) {
            setIssues([]);
            setSelected(0);
          }
          return;
        }
        logger.debug("loading view", { view: activeView.name, projects });
        const data = await ctx.issues.list(projects, activeView, activeView.query_limit ?? 100);
        setIssues(data);
        // Restore the cursor onto the previously selected issue when refreshing;
        // fall back to the top if it is gone or this was a view switch.
        setSelected(
          restoredSelection(
            data.map((i) => i.key),
            previousKey,
          ),
        );
        logger.debug("view loaded", { view: activeView.name, count: data.length });
      } catch (err) {
        const message = (err as Error).message;
        setError(message);
        logger.error("view load failed", { view: activeView.name, err: err as Error });
      } finally {
        setLoading(false);
      }
    },
    [ctx, activeView, logger],
  );

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

  // Mirror the selected key into a ref so load(preserveSelection) can re-anchor
  // the cursor after a refresh without depending on a stale closure.
  useEffect(() => {
    selectedKeyRef.current = currentSummary?.key;
  }, [currentSummary]);

  // The comment editor's state and key handling live in a hook; onSubmit posts
  // the comment, reports the outcome, and refreshes the detail view.
  const comments = useCommentEditor({
    target: currentSummary,
    onSubmit: async (issue, text) => {
      try {
        await ctx.issues.comment(issue.key, text);
        setError(`commented on ${issue.key}`);
        void load(true);
      } catch (err) {
        logger.error("comment failed", { issue: issue.key, err: err as Error });
        setError((err as Error).message);
      }
    },
  });

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
    "global.refresh": () => void load(true),
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
    "list.comment": comments.open,
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
      "detail.comment": comments.open,
      "global.help": () => setHelpOpen((open) => !open),
      "global.refresh": () => void load(true),
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
    if (comments.active) return comments.handleKey(input, key);
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

  const isDetail = panel === "detail";
  const overlayContent = comments.active ? (
    renderCommentContent(currentSummary, comments)
  ) : helpOpen ? (
    <HelpModal bindings={ctx.keybindings} onClose={() => setHelpOpen(false)} />
  ) : isDetail ? (
    <IssueDetail
      issue={current}
      loading={detailLoading}
      variant="modal"
      scrollTop={detailScroll}
      viewportRows={detailViewportRows}
      height={detailModalHeight}
    />
  ) : undefined;
  const overlay = renderOverlay({
    content: overlayContent,
    height: terminalRows,
    alignTop: isDetail,
    padded: comments.active,
    statusBar: (
      <StatusBar
        {...statusBarBase}
        loading={overlayLoading(comments.submitting, isDetail, detailLoading, loading)}
        position={isDetail && !current ? undefined : listPosition}
      />
    ),
  });
  if (overlay) return overlay;

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
