import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import type { Issue } from "../types/issue.js";
import type { AppContext } from "../app.js";
import { StatusBar } from "./status-bar.js";
import { ViewSelector, SIDE_PANEL_WIDTH, type ViewEntry } from "./view-selector.js";
import type { ViewLayout, ViewFilters } from "../types/views.js";
import type { UpdateIssuePatch } from "../plane/work-items.js";
import { IssueList, resolveLayout } from "./issue-list.js";
import { IssueDetail, DETAIL_CHROME_ROWS } from "./issue-detail.js";
import { FilterBox } from "./filter-box.js";
import { HelpModal } from "./help-modal.js";
import { CommentEditor } from "./comment-editor.js";
import { useCommentEditor } from "./use-comment-editor.js";
import { IssueEditor } from "./issue-editor.js";
import { IssueCreator } from "./issue-creator.js";
import { SelectModal } from "./select-modal.js";
import { useIssueEditor } from "./use-issue-editor.js";
import { useIssueCreator } from "./use-issue-creator.js";
import { buildIssueUrl } from "../utils/urls.js";
import { defaultBrowserOpener } from "../utils/browser.js";
import type { FileLogger } from "../utils/file-logger.js";
import { dispatch } from "../keybindings/dispatcher.js";
import { buildViewEntries, resolveViewProjectsLenient } from "../config/resolve-view-projects.js";
import { useViewsData } from "./use-views-data.js";
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

// Auto-refresh interval used when defaults.auto_refresh_seconds is omitted.
export const DEFAULT_AUTO_REFRESH_SECONDS = 15;

// autoRefreshIntervalMs turns the configured interval (seconds) into the
// setInterval delay in milliseconds, or undefined when auto-refresh is off.
// An omitted value falls back to DEFAULT_AUTO_REFRESH_SECONDS; 0 disables it.
export function autoRefreshIntervalMs(configuredSeconds: number | undefined): number | undefined {
  const seconds = configuredSeconds ?? DEFAULT_AUTO_REFRESH_SECONDS;
  return seconds > 0 ? seconds * 1000 : undefined;
}

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

// patchTouchesViewFilter reports whether an edit patch changed a field the
// active view filters on, in which case the edit may move the issue in or out of
// the view and the row must be reconciled by a refresh rather than patched in
// place. Maps each editable field to the filter(s) that key off it; `state_id`
// covers both the state_group and the client-side state_search filters.
export function patchTouchesViewFilter(
  patch: UpdateIssuePatch,
  filters: ViewFilters | undefined,
): boolean {
  if (!filters) return false;
  if (patch.state_id !== undefined && (filters.state_group || filters.state_search)) return true;
  if (patch.priority !== undefined && filters.priority) return true;
  if (patch.assignee_ids !== undefined && filters.assignee) return true;
  if (patch.label_ids !== undefined && filters.labels) return true;
  return false;
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

// renderEditorContent builds the edit modal node: the inner SelectModal when a
// field picker is open, otherwise the field form. The hook guarantees an issue
// and draft while active, so the guard only narrows the optional types.
function renderEditorContent(
  editor: ReturnType<typeof useIssueEditor>,
): React.ReactNode | undefined {
  if (!editor.issue || !editor.draft) return undefined;
  if (editor.picker) {
    const titles: Record<string, string> = {
      state: "set state",
      assignee: "set assignees",
      priority: "set priority",
      labels: "set labels",
    };
    return (
      <SelectModal
        title={titles[editor.picker.kind] ?? "select"}
        options={editor.picker.options}
        state={editor.picker.state}
        multi={editor.picker.multi}
      />
    );
  }
  return (
    <IssueEditor
      issue={editor.issue}
      draft={editor.draft}
      field={editor.field}
      dirty={editor.dirty}
      saving={editor.saving}
      confirmingExit={editor.confirmingExit}
      names={editor.names}
      textEdit={editor.textEdit}
    />
  );
}

const PICKER_TITLES: Record<string, string> = {
  project: "select project",
  state: "set state",
  assignee: "set assignees",
  priority: "set priority",
  labels: "set labels",
};

// renderCreatorContent builds the create modal node: the project picker / a field
// picker when one is open, otherwise the new-issue form.
function renderCreatorContent(
  creator: ReturnType<typeof useIssueCreator>,
): React.ReactNode | undefined {
  if (creator.picker) {
    return (
      <SelectModal
        title={PICKER_TITLES[creator.picker.kind] ?? "select"}
        options={creator.picker.options}
        state={creator.picker.state}
        multi={creator.picker.multi}
      />
    );
  }
  return (
    <IssueCreator
      projectIdentifier={creator.projectIdentifier}
      draft={creator.draft}
      field={creator.field}
      saving={creator.saving}
      names={creator.names}
      textEdit={creator.textEdit}
    />
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
  const [selected, setSelected] = useState(0);
  // statusMessage holds a transient status message from the comment flow. View
  // fetch errors live per-view inside useViewsData; this is only for actions
  // that are not tied to a single view's fetch lifecycle.
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
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

  // Effective column layout for the active view: its own layout, else the
  // profile default, else empty (the solver falls back to responsive constants).
  const activeLayout = useMemo(
    () => resolveLayout(activeView?.layout, ctx.runtime.profile.defaults?.layout),
    [activeView, ctx],
  );

  // Tracks the key of the currently selected issue so a refresh can restore the
  // selection on the same item instead of jumping back to the top (gh-dash #735).
  const selectedKeyRef = React.useRef<string | undefined>(undefined);

  // Per-view fetch state lives in this hook so the navbar can show a live count
  // per view and a view switch can reuse the previous result instead of flashing
  // a skeleton. The dashboard only reads the active view's slice below.
  const viewsData = useViewsData({
    views,
    issuesService: ctx.issues,
    defaultProjects: ctx.runtime.profile.defaults?.projects,
    defaultsSort: ctx.runtime.profile.defaults?.sort,
    logger,
  });
  const active = viewsData.byView[viewIdx] ?? {
    issues: [],
    loading: false,
    error: undefined,
    loaded: false,
    failedProjects: [],
  };
  const issues = active.issues;
  const loading = active.loading;
  // A partial load (some projects timed out / errored) is surfaced as a degraded
  // message so the rows are not mistaken for the whole view. A transient action
  // message (statusMessage) and a hard view error still take precedence.
  const partialMessage =
    active.failedProjects.length > 0
      ? `partial: ${active.failedProjects.length} project(s) unavailable (${active.failedProjects.join(", ")})`
      : undefined;
  const error = statusMessage ?? active.error ?? partialMessage;

  // Merge the static markers with each view's live count/loading so the navbar
  // shows "(N)" beside loaded views and a spinner while one is fetching. Count
  // stays undefined (no badge) until a view has loaded at least once.
  const navbarEntries = useMemo(
    () =>
      viewEntries.map((entry, idx) => {
        const data = viewsData.byView[idx];
        return {
          ...entry,
          loading: data?.loading ?? false,
          count: data?.loaded ? data.issues.length : undefined,
        };
      }),
    [viewEntries, viewsData.byView],
  );

  // load wraps the hook's per-view loader for the active view. preserveSelection
  // re-anchors the cursor on the previously selected issue (refresh); otherwise
  // it falls to the top (view switch / first load). Depends only on the stable
  // loader (not the changing byView) so it does not churn on every fetch tick.
  const loadView = viewsData.load;
  const load = useCallback(
    async (preserveSelection = false): Promise<void> => {
      const previousKey = preserveSelection ? selectedKeyRef.current : undefined;
      const keys = await loadView(viewIdx);
      setSelected(restoredSelection(keys, previousKey));
    },
    [loadView, viewIdx],
  );

  // On a view switch, fetch the view if it has never loaded; otherwise reuse its
  // cached rows/count and just reset the cursor to the top. Either way the list
  // keeps showing data (cached or skeleton-then-data) — never blanks mid-switch.
  // loadedRef reads the latest per-view state without retriggering the effect.
  const loadedRef = React.useRef(viewsData.byView);
  loadedRef.current = viewsData.byView;
  useEffect(() => {
    if (!activeView) return;
    if (loadedRef.current[viewIdx]?.loaded) setSelected(0);
    else void load();
  }, [viewIdx, activeView, load]);

  useEffect(() => {
    logger.info("dashboard started", {
      profile: ctx.runtime.profile_name,
      workspace: ctx.runtime.profile.server.workspace_slug,
      views: views.length,
    });
    if (views.length === 0) {
      setStatusMessage("no views configured — add `views:` to your profile in config.yaml");
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
        setStatusMessage(`commented on ${issue.key}`);
        void load(true);
      } catch (err) {
        logger.error("comment failed", { issue: issue.key, err: err as Error });
        setStatusMessage((err as Error).message);
      }
    },
  });

  // The edit modal's state and key handling live in a hook; onSave issues one
  // PATCH with the changed fields and reflects the result in place: the updated
  // row replaces the old one (selection/scroll preserved, no refetch flicker).
  // When the edited field is one the active view filters on, the change can move
  // the issue in or out of the view, so that case falls back to a refresh to
  // reconcile; otherwise it stays a pure in-place patch.
  const project = (issue: Issue): import("../types/project.js").Project => ({
    id: issue.project_id,
    identifier: issue.project_identifier,
    name: "",
    workspace_id: "",
  });
  const editor = useIssueEditor({
    target: currentSummary,
    loadStates: (issue) => ctx.states.list(project(issue)),
    loadMembers: () => ctx.users.list(),
    loadLabels: (issue) => ctx.labels.list(project(issue)),
    onSave: async (issue, patch) => {
      try {
        const updated = await ctx.issues.update(issue.key, patch);
        setStatusMessage(`updated ${issue.key}`);
        if (patchTouchesViewFilter(patch, activeView?.filters)) void load(true);
        else viewsData.patchIssue(viewIdx, updated);
      } catch (err) {
        logger.error("edit failed", { issue: issue.key, err: err as Error });
        setStatusMessage(`${issue.key}: ${(err as Error).message}`);
        throw err;
      }
    },
    onError: (message) => {
      logger.error("edit picker load failed", { message });
      setStatusMessage(message);
    },
  });

  // Projects the active view resolves to, used as the create modal's project
  // choices (a single one is inferred, several open a picker).
  const activeProjects = useMemo(
    () => resolveViewProjectsLenient(activeView ?? { name: "" }, defaultProjects).projects,
    [activeView, defaultProjects],
  );
  // The create modal reuses the edit form and pickers but creates instead of
  // patching. states/labels load against the chosen project (by identifier;
  // the services resolve the id from the identifier through the cache).
  const creator = useIssueCreator({
    projects: activeProjects,
    loadStates: (identifier) =>
      ctx.projects.findByIdentifier(identifier).then((p) => ctx.states.list(p)),
    loadMembers: () => ctx.users.list(),
    loadLabels: (identifier) =>
      ctx.projects.findByIdentifier(identifier).then((p) => ctx.labels.list(p)),
    onCreate: async (identifier, d) => {
      try {
        const created = await ctx.issues.create(identifier, {
          name: d.name,
          description: d.description || undefined,
          priority: d.priority,
          state_id: d.state_id || undefined,
          assignee_ids: d.assignee_ids,
          label_ids: d.label_ids,
        });
        setStatusMessage(`created ${created.key}`);
        void load(true);
      } catch (err) {
        logger.error("create failed", { project: identifier, err: err as Error });
        setStatusMessage(`create: ${(err as Error).message}`);
        throw err;
      }
    },
    onError: (message) => {
      logger.error("create picker load failed", { message });
      setStatusMessage(message);
    },
  });

  // Auto-refresh: re-run load(true) on the configured interval so the list
  // tracks Plane without a keystroke. Paused while any overlay is open (detail,
  // comment, edit, help, filter) so it never refetches under the user's cursor;
  // the timer restarts whenever the view, interval, or overlay state changes.
  const overlayActive =
    comments.active ||
    editor.active ||
    creator.active ||
    helpOpen ||
    panel === "detail" ||
    filtering;
  const intervalMs = autoRefreshIntervalMs(ctx.runtime.profile.defaults?.auto_refresh_seconds);
  useEffect(() => {
    if (intervalMs === undefined || overlayActive || !activeView) return;
    const timer = setInterval(() => {
      void load(true);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, overlayActive, activeView, load]);

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
        setStatusMessage(err.message);
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
      setStatusMessage((err as Error).message);
    }
  }, [filtered, selected, ctx, logger]);

  const selectNext = (): void => setSelected((s) => Math.min(filtered.length - 1, s + 1));
  const selectPrev = (): void => setSelected((s) => Math.max(0, s - 1));
  const viewNext = (): void => setViewIdx((i) => Math.min(views.length - 1, i + 1));
  const viewPrev = (): void => setViewIdx((i) => Math.max(0, i - 1));

  const handlers: Partial<Record<ActionId, () => void>> = {
    "global.quit": () => exit(),
    "global.refresh": () => void load(true),
    "global.refresh-all": () => viewsData.refreshAll(),
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
    "list.edit": editor.open,
    "list.create": creator.open,
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
      "detail.edit": editor.open,
      "global.help": () => setHelpOpen((open) => !open),
      "global.refresh": () => void load(true),
      "global.refresh-all": () => viewsData.refreshAll(),
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
    if (creator.active) return creator.handleKey(input, key);
    if (editor.active) return editor.handleKey(input, key);
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
  const overlayContent = creator.active ? (
    renderCreatorContent(creator)
  ) : editor.active ? (
    renderEditorContent(editor)
  ) : comments.active ? (
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
    padded: comments.active || editor.active || creator.active,
    statusBar: (
      <StatusBar
        {...statusBarBase}
        loading={
          creator.active
            ? creator.saving
            : editor.active
              ? editor.saving
              : overlayLoading(comments.submitting, isDetail, detailLoading, loading)
        }
        position={
          editor.active || creator.active || (isDetail && !current) ? undefined : listPosition
        }
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
      viewEntries={navbarEntries}
      viewIdx={viewIdx}
      issues={filtered}
      selected={selected}
      filter={filter}
      filtering={filtering}
      viewportRows={viewportRows}
      layout={activeLayout}
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
  viewEntries: ViewEntry[];
  viewIdx: number;
  issues: Issue[];
  selected: number;
  filter: string;
  filtering: boolean;
  viewportRows: number;
  // Resolved column layout for the active view, threaded to the issue list.
  layout: ViewLayout;
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
            layout={props.layout}
            loading={props.loading}
          />
          <FilterBox active={props.filtering} value={props.filter} />
        </Box>
      </Box>
      {props.statusBar}
    </Box>
  );
}
