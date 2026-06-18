import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { useTheme } from "./theme/context.js";
import type { Issue } from "../types/issue.js";
import type { AppContext } from "../app.js";
import { StatusBar } from "./status-bar.js";
import { ViewSelector, SIDE_PANEL_WIDTH, type ViewEntry } from "./view-selector.js";
import type { SortKey, ViewDefinition, ViewLayout } from "../types/views.js";
import type { ProfileConfig } from "../types/config.js";
import { resolveSort } from "../plane/sort-issues.js";
import { IssueList, resolveLayout } from "./issue-list.js";
import { IssueDetail, DETAIL_CHROME_ROWS, type DetailMode } from "./issue-detail.js";
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
import { formatListPosition } from "./issue-query.js";
import { useViewsData } from "./use-views-data.js";
import { useTerminalSize } from "./use-terminal-size.js";
import { useIssueFilter } from "./use-issue-filter.js";
import { useQuickTransition } from "./use-quick-transition.js";
import { useDetailPanel } from "./use-detail-panel.js";
import { useActivityLog } from "./use-activity-log.js";
import { useRelations } from "./use-relations.js";
import { useDetailStack, targetFromIssue } from "./use-detail-stack.js";
import { patchTouchesViewFilter } from "./view-filter-reconcile.js";
import type { ActionId } from "../keybindings/registry.js";
import type { InkKey } from "../keybindings/key-spec.js";

export interface DashboardProps {
  ctx: AppContext;
  logger: FileLogger;
}

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

// TransitionConfirm names the exact state move and gates it on y/n, so a quick
// transition is never silent. Shown over the list while a transition is pending.
function TransitionConfirm(props: {
  issueKey: string;
  from: string;
  to: string;
  saving: boolean;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.accent}
      paddingX={2}
      paddingY={1}
    >
      <Text>
        {props.issueKey}: <Text dimColor>{props.from}</Text> →{" "}
        <Text color={theme.accent}>{props.to}</Text>
      </Text>
      <Box marginTop={1}>
        <Text color={theme.warning}>{props.saving ? "applying… " : "apply? y / n"}</Text>
      </Box>
    </Box>
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

// ActiveOverlayInput is everything renderActiveOverlay needs to pick and frame
// the single overlay that is showing (if any), keeping that precedence and its
// status-bar bookkeeping out of the Dashboard body.
interface ActiveOverlayInput {
  transition: ReturnType<typeof useQuickTransition>;
  creator: ReturnType<typeof useIssueCreator>;
  editor: ReturnType<typeof useIssueEditor>;
  comments: ReturnType<typeof useCommentEditor>;
  detail: ReturnType<typeof useDetailPanel>;
  activity: ReturnType<typeof useActivityLog>;
  relations: ReturnType<typeof useRelations>;
  relationsSelected: number;
  detailMode: DetailMode;
  helpOpen: boolean;
  isDetail: boolean;
  currentSummary: Issue | undefined;
  current: Issue | undefined;
  detailViewportRows: number;
  detailModalHeight: number;
  terminalRows: number;
  loading: boolean;
  listPosition: string | undefined;
  statusBarBase: Omit<React.ComponentProps<typeof StatusBar>, "loading" | "position">;
  bindings: AppContext["keybindings"];
  closeHelp: () => void;
}

// renderActiveOverlay selects the highest-precedence overlay (transition > create
// > edit > comment > help > detail) and frames it with the shared chrome and a
// status bar whose spinner/position reflect that overlay. Returns null when none
// is active, so the dashboard falls through to the list layout.
function renderActiveOverlay(opts: ActiveOverlayInput): React.ReactElement | null {
  const { transition, creator, editor, comments, detail, isDetail, current } = opts;
  const content = transition.pending ? (
    <TransitionConfirm
      issueKey={transition.pending.issue.key}
      from={transition.pending.fromName}
      to={transition.pending.targetName}
      saving={transition.pending.saving}
    />
  ) : creator.active ? (
    renderCreatorContent(creator)
  ) : editor.active ? (
    renderEditorContent(editor)
  ) : comments.active ? (
    renderCommentContent(opts.currentSummary, comments)
  ) : opts.helpOpen ? (
    <HelpModal bindings={opts.bindings} onClose={opts.closeHelp} />
  ) : isDetail ? (
    <IssueDetail
      issue={current}
      loading={detail.loading}
      variant="modal"
      mode={opts.detailMode}
      timeInState={opts.activity.timeInState}
      stateChanges={opts.activity.stateChanges}
      activityLoading={opts.activity.loading}
      relations={opts.relations.relations}
      relationsSelected={opts.relationsSelected}
      relationsLoading={opts.relations.loading}
      scrollTop={detail.scroll}
      viewportRows={opts.detailViewportRows}
      height={opts.detailModalHeight}
    />
  ) : undefined;

  return renderOverlay({
    content,
    height: opts.terminalRows,
    alignTop: isDetail,
    padded: comments.active || editor.active || creator.active,
    statusBar: (
      <StatusBar
        {...opts.statusBarBase}
        loading={overlayStatusLoading(opts)}
        position={overlayStatusPosition(opts)}
      />
    ),
  });
}

// overlayStatusLoading picks the spinner flag for the active overlay's status
// bar: the editor/creator show their own save state; otherwise it follows the
// detail/list loading flag (a submitting comment always spins).
function overlayStatusLoading(opts: ActiveOverlayInput): boolean {
  if (opts.creator.active) return opts.creator.saving;
  if (opts.editor.active) return opts.editor.saving;
  return overlayLoading(opts.comments.submitting, opts.isDetail, opts.detail.loading, opts.loading);
}

// overlayStatusPosition hides the list position while the editor/creator own the
// screen or the detail panel has no issue yet; otherwise it shows the count.
function overlayStatusPosition(opts: ActiveOverlayInput): string | undefined {
  if (opts.editor.active || opts.creator.active) return undefined;
  if (opts.isDetail && !opts.current) return undefined;
  return opts.listPosition;
}

// resolveViewPresentation resolves the active view's layout and sort, each
// falling back to the profile default then the built-in. Kept out of Dashboard
// so the optional-chaining lives here rather than inflating the component.
function resolveViewPresentation(
  view: ViewDefinition | undefined,
  defaults: ProfileConfig["defaults"],
): { layout: ViewLayout; sort: SortKey[] } {
  return {
    layout: resolveLayout(view?.layout, defaults?.layout),
    sort: resolveSort(view?.sort, defaults?.sort),
  };
}

// Dashboard is the composition root: it wires the per-feature hooks (views data,
// filter, quick transition, detail panel, editor, creator, comments) together,
// routes input to the active context, and renders the active overlay or the list
// layout. The per-mode state machines live in their own hooks/files.
export function Dashboard({ ctx, logger }: DashboardProps): React.ReactElement {
  const { exit } = useApp();
  const { rows: terminalRows, columns: terminalCols } = useTerminalSize();

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
  // The detail panel is driven by a navigation stack: opening from the list seeds
  // it, following a relation pushes onto it, and esc pops (closing on the last
  // entry). `stack.current` being defined is what "the detail is open" means.
  const stack = useDetailStack();
  const detailOpen = stack.current !== undefined;
  // Which body the detail modal shows (description / activity / relations),
  // toggled by `a` / `l`. Reset to "detail" whenever the panel closes so each
  // issue opens on its description, never carrying the previous body.
  const [detailMode, setDetailMode] = useState<DetailMode>("detail");
  // Focused relation row index in the relations body; reset on close / mode flip.
  const [relationsSelected, setRelationsSelected] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const activeView = views[viewIdx];

  // Effective layout and sort for the active view (each: its own, else the
  // profile default, else the built-in). Threaded to the list so it can size
  // columns and show which column the rows are ordered by.
  const { layout: activeLayout, sort: activeSort } = useMemo(
    () => resolveViewPresentation(activeView, ctx.runtime.profile.defaults),
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
    defaults: ctx.runtime.profile.defaults,
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

  // The `/` filter (open/closed state, the typed query, client-side narrowing of
  // the loaded rows, and `ass:me` resolution) lives in its own hook.
  const {
    filter,
    filtering,
    filtered,
    startFilter,
    handleKey: handleFilterKey,
  } = useIssueFilter({
    issues,
    ctx,
    logger,
  });

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
  // reconcile reflects a committed mutation in the list: a refresh when the
  // change can move the issue in/out of the view's filter, else a pure in-place
  // row patch (selection/scroll preserved, no refetch flicker). Shared by the
  // edit modal and the quick transition.
  const reconcile = useCallback(
    (updated: Issue, touchesFilter: boolean): void => {
      if (touchesFilter) void load(true);
      else viewsData.patchIssue(viewIdx, updated);
    },
    [load, viewsData, viewIdx],
  );
  const editor = useIssueEditor({
    target: currentSummary,
    loadStates: (issue) => ctx.states.list(project(issue)),
    loadMembers: () => ctx.users.list(),
    loadLabels: (issue) => ctx.labels.list(project(issue)),
    onSave: async (issue, patch) => {
      try {
        const updated = await ctx.issues.update(issue.key, patch);
        setStatusMessage(`updated ${issue.key}`);
        reconcile(updated, patchTouchesViewFilter(patch, activeView?.filters));
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

  // The `>` / `<` quick state transition (neighbour resolution, the y/n
  // confirmation, and the committing update) lives in its own hook; it reconciles
  // the row through the shared reconcile callback.
  const transition = useQuickTransition({
    target: currentSummary,
    activeView,
    ctx,
    logger,
    setMessage: setStatusMessage,
    reconcile,
  });

  // Auto-refresh: re-run load(true) on the configured interval so the list
  // tracks Plane without a keystroke. Paused while any overlay is open (detail,
  // comment, edit, help, filter) so it never refetches under the user's cursor;
  // the timer restarts whenever the view, interval, or overlay state changes.
  const overlayActive = [
    comments.active,
    editor.active,
    creator.active,
    transition.active,
    helpOpen,
    detailOpen,
    filtering,
  ].some(Boolean);
  const intervalMs = autoRefreshIntervalMs(ctx.runtime.profile.defaults?.auto_refresh_seconds);
  useEffect(() => {
    if (intervalMs === undefined || overlayActive || !activeView) return;
    const timer = setInterval(() => {
      void load(true);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, overlayActive, activeView, load]);

  // The detail panel's data (full issue with description, fetched on open) and
  // scroll position live in their own hook; the active target is the top of the
  // navigation stack (the list issue, or a relation pushed onto it).
  const detail = useDetailPanel({
    open: detailOpen,
    target: stack.current,
    ctx,
    logger,
    setMessage: setStatusMessage,
  });

  // The activity log and relations load alongside the detail panel in their own
  // hooks, so their fetches never block the description. Activity feeds the "time
  // in state" line and the `a` body; relations feed the `l` body. createdAt comes
  // from the retrieved issue (the stack target carries only identity).
  const activity = useActivityLog({
    open: detailOpen,
    target: stack.current,
    createdAt: detail.detailed?.created_at,
    ctx,
    logger,
  });
  const relations = useRelations({
    open: detailOpen,
    target: stack.current,
    activities: activity.activities,
    ctx,
    logger,
  });
  // Reset the body mode and relation cursor whenever the panel closes (so the next
  // open starts on the description) or the active target changes (so navigating a
  // relation lands on the new issue's description, not the previous body/cursor).
  useEffect(() => {
    setDetailMode("detail");
    setRelationsSelected(0);
  }, [stack.current]);

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
    "list.open-detail": () => {
      if (currentSummary) stack.open(targetFromIssue(currentSummary));
    },
    "list.open-browser": openSelectedInBrowser,
    "list.comment": comments.open,
    "list.edit": editor.open,
    "list.create": creator.open,
    "list.state-next": () => void transition.start(1),
    "list.state-prev": () => void transition.start(-1),
    "view.next": viewNext,
    "view.next-alt": viewNext,
    "view.prev": viewPrev,
    "view.prev-alt": viewPrev,
    "filter.start": startFilter,
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

  // openFocusedRelation navigates into the relation under the cursor. It prefers
  // the already-resolved target issue (carrying its project id); if the lazy
  // retrieve has not landed yet it resolves by key on demand. Either way it pushes
  // onto the stack so the detail reloads on the related issue with esc as back.
  const openFocusedRelation = useCallback((): void => {
    const relation = relations.relations[relationsSelected];
    if (!relation) return;
    if (relation.target) {
      stack.push(targetFromIssue(relation.target));
      return;
    }
    if (!relation.targetKey) return;
    void ctx.issues
      .view(relation.targetKey)
      .then((issue) => stack.push(targetFromIssue(issue)))
      .catch((err: Error) => {
        logger.error("open relation failed", { key: relation.targetKey, err });
        setStatusMessage(`open ${relation.targetKey}: ${err.message}`);
      });
  }, [relations.relations, relationsSelected, stack, ctx, logger]);

  // In the relations body, j/k move the relation cursor and enter opens it; in the
  // text bodies the same keys scroll. The handler map is built per active body so
  // the shared detail keys (esc, a, l, o, c, e) work in both.
  const handleDetailKey = (input: string, key: InkKey): void => {
    const relationsMode = detailMode === "relations";
    const relationCount = relations.relations.length;
    const detailHandlers: Partial<Record<ActionId, () => void>> = {
      // esc pops the navigation stack: back to the issue we came from, or close.
      "detail.close": () => stack.pop(),
      "detail.scroll-down": relationsMode
        ? () => setRelationsSelected((s) => Math.min(relationCount - 1, s + 1))
        : () => detail.scrollBy(1),
      "detail.scroll-down-alt": relationsMode
        ? () => setRelationsSelected((s) => Math.min(relationCount - 1, s + 1))
        : () => detail.scrollBy(1),
      "detail.scroll-up": relationsMode
        ? () => setRelationsSelected((s) => Math.max(0, s - 1))
        : () => detail.scrollBy(-1),
      "detail.scroll-up-alt": relationsMode
        ? () => setRelationsSelected((s) => Math.max(0, s - 1))
        : () => detail.scrollBy(-1),
      "detail.page-down": () => detail.scrollBy(detailViewportRows),
      "detail.page-up": () => detail.scrollBy(-detailViewportRows),
      "detail.top": detail.scrollTop,
      "detail.bottom": detail.scrollBottom,
      "detail.open-browser": openSelectedInBrowser,
      "detail.comment": comments.open,
      "detail.edit": editor.open,
      // Toggle the activity / relations bodies; toggling back returns to the
      // description. Reset the scroll so the new body starts at the top.
      "detail.activity": () => {
        setDetailMode((mode) => (mode === "activity" ? "detail" : "activity"));
        detail.scrollTop();
      },
      "detail.relations": () => {
        setDetailMode((mode) => (mode === "relations" ? "detail" : "relations"));
        setRelationsSelected(0);
        detail.scrollTop();
      },
      // enter only acts in the relations body, opening the focused relation.
      "detail.relation-open": relationsMode ? openFocusedRelation : (): void => {},
      "global.help": () => setHelpOpen((open) => !open),
      "global.refresh": () => void load(true),
      "global.refresh-all": () => viewsData.refreshAll(),
      "global.quit": () => stack.close(),
    };
    dispatch(ctx.keybindings, ["detail", "global"], detailHandlers, input, key);
  };

  // Keystrokes route to the first active context in precedence order; when none
  // is active they fall through to the list/global dispatch. A data-driven table
  // keeps this as one loop instead of an if-ladder.
  type KeyHandler = (input: string, key: InkKey) => void;
  const keyRoutes: Array<[active: boolean, handle: KeyHandler]> = [
    [transition.active, transition.handleKey],
    [creator.active, creator.handleKey],
    [editor.active, editor.handleKey],
    [comments.active, comments.handleKey],
    [helpOpen, handleHelpKey],
    [detailOpen, handleDetailKey],
    [filtering, handleFilterKey],
  ];
  useInput((input, key) => {
    const route = keyRoutes.find(([active]) => active);
    if (route) return route[1](input, key);
    dispatch(ctx.keybindings, ["global", "list", "view", "filter"], handlers, input, key);
  });

  // The detail shows the retrieved full issue. At the root of the stack the list
  // summary is the same issue, so it serves as instant content before the
  // retrieve lands; after navigating into a relation the summary is a different
  // issue, so fall back to nothing (the loading placeholder) instead.
  const current = detail.detailed ?? (stack.canGoBack ? undefined : currentSummary);

  // Shared status-bar props. profile/workspace/view are identical across panels;
  // loading and position vary slightly per panel and are passed at each call.
  const statusBarBase = {
    profile: ctx.runtime.profile_name,
    workspace: ctx.runtime.profile.server.workspace_slug,
    view: activeView?.name ?? "—",
    message: error,
  };
  // Position shows cursor/visible-count; with an active filter it also reports
  // how many of the loaded rows match, so an over-narrow query (or a zero match)
  // reads as "filtered", not "no data". 0 matches still surfaces the count.
  const listPosition = formatListPosition({
    selected,
    matched: filtered.length,
    total: issues.length,
    filtering: Boolean(filter),
  });

  const isDetail = detailOpen;
  const overlay = renderActiveOverlay({
    transition,
    creator,
    editor,
    comments,
    detail,
    activity,
    relations,
    relationsSelected,
    detailMode,
    helpOpen,
    isDetail,
    currentSummary,
    current,
    detailViewportRows,
    detailModalHeight,
    terminalRows,
    loading,
    listPosition,
    statusBarBase,
    bindings: ctx.keybindings,
    closeHelp: () => setHelpOpen(false),
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
      sort={activeSort}
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
  // Resolved sort for the active view, threaded to the issue list so its header
  // can show which column the rows are ordered by.
  sort: SortKey[];
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
            sort={props.sort}
            loading={props.loading}
          />
          <FilterBox active={props.filtering} value={props.filter} />
        </Box>
      </Box>
      {props.statusBar}
    </Box>
  );
}
