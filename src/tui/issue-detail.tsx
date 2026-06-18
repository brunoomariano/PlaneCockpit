import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { Issue } from "../types/issue.js";
import type { IssueActivity } from "../types/activity.js";
import type { IssueRelation } from "../types/relation.js";
import { RELATION_LABELS } from "../types/relation.js";
import { markdownToAnsi } from "../utils/markdown-to-ansi.js";
import { splitAnsiIntoLines } from "../utils/ansi-lines.js";
import { humanizeDuration } from "../utils/format-duration.js";
import { formatRelationRow } from "./format-relation.js";
import { useTheme } from "./theme/context.js";

// DetailMode selects what the body shows: the issue description ("detail"), its
// state-change history ("activity", `a`), or its relations ("relations", `l`).
export type DetailMode = "detail" | "activity" | "relations";

export interface IssueDetailProps {
  issue?: Issue;
  loading?: boolean;
  variant?: "panel" | "modal";
  // viewport controls the scrollable body region. Ignored in panel variant.
  scrollTop?: number;
  viewportRows?: number;
  // Total height to lock the modal box into, so the body never spills past the
  // status bar at the bottom of the terminal.
  height?: number;
  // Which body to render; defaults to "detail" (the description).
  mode?: DetailMode;
  // Humanized time the issue has spent in its current state (e.g. "3d 4h"),
  // shown in the meta block when known. Omitted while the log is still loading.
  timeInState?: string;
  // State-change events (oldest→newest) for the activity body. Empty until the
  // log loads; the activity mode shows a placeholder while empty.
  stateChanges?: IssueActivity[];
  // True while the activity log fetch is in flight, for the activity placeholder.
  activityLoading?: boolean;
  // Relations (display-ordered) and the focused row index for the relations body.
  relations?: IssueRelation[];
  relationsSelected?: number;
  // True while the relations fetch is in flight, for the relations placeholder.
  relationsLoading?: boolean;
}

// formatStateChange renders one state transition as a single line for the
// activity body: "Inbox → Backlog · 2d ago". A missing old value (the first
// transition out of the implicit initial state) drops the arrow's left side. A
// sub-minute change reads "· just now" (no "ago" suffix, which would be
// ungrammatical), matching humanizeDuration's floor.
export function formatStateChange(activity: IssueActivity, now: number): string {
  const when = Date.parse(activity.createdAt);
  const from = activity.oldValue ? `${activity.oldValue} → ` : "→ ";
  const head = `${from}${activity.newValue ?? "?"}`;
  if (Number.isNaN(when)) return head;
  const elapsed = humanizeDuration(now - when);
  return elapsed === "just now" ? `${head} · just now` : `${head} · ${elapsed} ago`;
}

const MODAL_WIDTH = 100;
const PANEL_WIDTH = 50;
// Chars of horizontal chrome subtracted from MODAL_WIDTH to get the printable
// area: 2 for the double-border + 2 for paddingX=1 each side.
const HORIZONTAL_CHROME = 4;

// Rows consumed by header + meta block + paddings before the description region.
// Used by the Dashboard to size the scroll viewport against the terminal height.
// 2 border + 2 paddingY + 1 header + 1 name + 1 margin + 5 meta rows + 1 margin
// + 2 for the up/down hints = ~15. We round up a little to leave breathing room.
export const DETAIL_CHROME_ROWS = 16;

// The fixed metadata block (state, priority, assignees, labels, updated). When
// the activity log has resolved, the state line also reports how long the issue
// has sat in its current state; until then the suffix is simply absent.
function IssueMeta({
  issue,
  timeInState,
}: {
  issue: Issue;
  timeInState?: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Box marginTop={1} flexDirection="column" flexShrink={0}>
      <Text>
        state: <Text color={theme.accent}>{issue.state.name}</Text>
        {timeInState ? <Text dimColor> · for {timeInState}</Text> : null}
      </Text>
      <Text>priority: {issue.priority}</Text>
      <Text wrap="truncate">
        assignees: {issue.assignees.map((a) => a.display_name).join(", ") || "—"}
      </Text>
      <Text wrap="truncate">labels: {issue.labels.map((l) => l.name).join(", ") || "—"}</Text>
      <Text dimColor>updated: {issue.updated_at}</Text>
    </Box>
  );
}

interface ScrollableBodyProps {
  // True while the underlying content is still loading and none is shown yet.
  loading: boolean;
  // Shown while loading with no content (e.g. "loading description…").
  loadingLabel: string;
  // Shown when there is genuinely no content (e.g. "(no description)").
  emptyLabel: string;
  visible: string[];
  hiddenAbove: number;
  hiddenBelow: number;
  scrollTop: number;
}

// The scrollable body region (description or activity) with the "N more" hints
// above/below. The loading/empty placeholders are passed in so the same scroll
// machinery serves both the description and the state-change list.
function ScrollableBody(props: ScrollableBodyProps): React.ReactElement {
  let content: React.ReactNode;
  if (props.loading && props.visible.length === 0) {
    content = <Text dimColor>{props.loadingLabel}</Text>;
  } else if (props.visible.length === 0 && props.hiddenAbove === 0 && props.hiddenBelow === 0) {
    content = <Text dimColor>{props.emptyLabel}</Text>;
  } else {
    content = (
      <>
        {props.hiddenAbove > 0 ? <Text dimColor>↑ {props.hiddenAbove} more</Text> : null}
        {props.visible.map((line, idx) => (
          <Text key={`${props.scrollTop}-${idx}`} wrap="truncate">
            {line.length > 0 ? line : " "}
          </Text>
        ))}
        {props.hiddenBelow > 0 ? <Text dimColor>↓ {props.hiddenBelow} more</Text> : null}
      </>
    );
  }
  return (
    <Box marginTop={1} flexDirection="column" overflow="hidden">
      {content}
    </Box>
  );
}

// RelationRow renders one relation line, highlighting it when focused. The line
// content (key · state · name · related_at) is assembled by formatRelationRow.
function RelationRow({
  relation,
  focused,
  now,
}: {
  relation: IssueRelation;
  focused: boolean;
  now: number;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Text wrap="truncate" color={focused ? theme.accent : undefined} bold={focused}>
      {focused ? "› " : "  "}
      {formatRelationRow(relation, now)}
    </Text>
  );
}

// RelationsBody renders the relations grouped by type with a focused row. The
// list is already display-ordered, so a heading is emitted whenever the type
// changes while walking it. A window around the focused row keeps long lists
// within the viewport without a separate scroll model.
function RelationsBody(props: {
  relations: IssueRelation[];
  selected: number;
  loading: boolean;
  viewportRows: number;
}): React.ReactElement {
  if (props.relations.length === 0) {
    return (
      <Box marginTop={1} flexDirection="column" overflow="hidden">
        <Text dimColor>{props.loading ? "loading relations…" : "(no relations)"}</Text>
      </Box>
    );
  }
  const now = Date.now();
  // Window the rows around the focused index so the selection stays visible.
  const start = Math.max(
    0,
    Math.min(props.selected - 1, props.relations.length - props.viewportRows),
  );
  const window = props.relations.slice(Math.max(0, start), Math.max(0, start) + props.viewportRows);
  let lastType: string | undefined;
  return (
    <Box marginTop={1} flexDirection="column" overflow="hidden">
      {window.map((relation, idx) => {
        const flatIdx = Math.max(0, start) + idx;
        const heading = relation.type !== lastType ? RELATION_LABELS[relation.type] : undefined;
        lastType = relation.type;
        return (
          <React.Fragment key={`${relation.type}-${relation.targetId}`}>
            {heading ? <Text dimColor>{heading}:</Text> : null}
            <RelationRow relation={relation} focused={flatIdx === props.selected} now={now} />
          </React.Fragment>
        );
      })}
    </Box>
  );
}

const HINT_BY_MODE: Record<DetailMode, string> = {
  detail: "esc to close · a: activity · l: relations",
  activity: "esc to close · a: description",
  relations: "esc back · enter: open · l: description",
};

function closeHintFor(
  scrollTop: number,
  viewportRows: number,
  total: number,
  mode: DetailMode,
): string {
  const label = HINT_BY_MODE[mode];
  // The relations body has its own selection model, so the scroll counter only
  // applies to the text bodies (description / activity).
  if (mode === "relations" || total <= viewportRows) return label;
  const end = Math.min(scrollTop + viewportRows, total);
  return `${label} · ${scrollTop + 1}-${end}/${total}`;
}

// DetailHeader is the top row: the issue key (tagged "· activity" in activity
// mode) on the left and, for the modal variant, the close/scroll hint on the
// right. Pulling it out keeps that mode/variant branching out of IssueDetail.
function DetailHeader(props: {
  issueKey: string;
  mode: DetailMode;
  variant: "panel" | "modal";
  scrollTop: number;
  viewportRows: number;
  total: number;
}): React.ReactElement {
  return (
    <Box justifyContent="space-between" flexShrink={0}>
      <Text bold>
        {props.issueKey}
        {props.mode !== "detail" ? <Text dimColor> · {props.mode}</Text> : null}
      </Text>
      {props.variant === "modal" ? (
        <Text dimColor>
          {closeHintFor(props.scrollTop, props.viewportRows, props.total, props.mode)}
        </Text>
      ) : null}
    </Box>
  );
}

// ResolvedBody is the scroll/labels/loading bundle the active mode hands to the
// view: the clamped scroll window over `lines` plus the placeholders to show
// while empty or loading. Computing it here keeps IssueDetail's branching down.
interface ResolvedBody {
  lines: string[];
  visible: string[];
  scrollTop: number;
  hiddenBelow: number;
  loading: boolean;
  loadingLabel: string;
  emptyLabel: string;
}

// Text bodies only (description / activity). The relations mode renders through
// RelationsBody, not resolveBody, so it carries no entry here.
const BODY_LABELS: Record<"detail" | "activity", { loadingLabel: string; emptyLabel: string }> = {
  detail: { loadingLabel: "loading description…", emptyLabel: "(no description)" },
  activity: { loadingLabel: "loading activity…", emptyLabel: "(no state changes)" },
};

// resolveBody clamps the scroll offset to the line count and selects the visible
// window and the mode-specific placeholders/loading flag for the active text body
// (description or activity); the relations body does not go through here.
function resolveBody(
  mode: "detail" | "activity",
  lines: string[],
  props: Pick<IssueDetailProps, "scrollTop" | "viewportRows" | "loading" | "activityLoading">,
): ResolvedBody {
  const viewportRows = props.viewportRows ?? lines.length;
  const scrollTop = Math.max(
    0,
    Math.min(props.scrollTop ?? 0, Math.max(0, lines.length - viewportRows)),
  );
  return {
    lines,
    visible: lines.slice(scrollTop, scrollTop + viewportRows),
    scrollTop,
    hiddenBelow: Math.max(0, lines.length - scrollTop - viewportRows),
    loading: (mode === "activity" ? props.activityLoading : props.loading) ?? false,
    ...BODY_LABELS[mode],
  };
}

// frameStyle returns the outer Box style for the panel/modal variants, so the
// variant branching lives in one place instead of three inline ternaries.
function frameStyle(
  variant: "panel" | "modal",
  accent: string,
): { borderStyle: "double" | "round"; borderColor: string | undefined; paddingY: number } {
  return variant === "modal"
    ? { borderStyle: "double", borderColor: accent, paddingY: 1 }
    : { borderStyle: "round", borderColor: undefined, paddingY: 0 };
}

// DetailBody picks the body for the active mode: the selectable relations list,
// or the scrollable text body (description / activity). Extracting it keeps the
// mode/prop-default branching out of IssueDetail's complexity budget.
function DetailBody(props: {
  mode: DetailMode;
  textBody: ResolvedBody;
  relations: IssueRelation[];
  relationsSelected: number;
  relationsLoading: boolean;
  relationsViewport: number;
}): React.ReactElement {
  if (props.mode === "relations") {
    return (
      <RelationsBody
        relations={props.relations}
        selected={props.relationsSelected}
        loading={props.relationsLoading}
        viewportRows={props.relationsViewport}
      />
    );
  }
  const b = props.textBody;
  return (
    <ScrollableBody
      loading={b.loading}
      loadingLabel={b.loadingLabel}
      emptyLabel={b.emptyLabel}
      visible={b.visible}
      hiddenAbove={b.scrollTop}
      hiddenBelow={b.hiddenBelow}
      scrollTop={b.scrollTop}
    />
  );
}

export function IssueDetail(props: IssueDetailProps): React.ReactElement {
  const theme = useTheme();
  const variant = props.variant ?? "panel";
  const mode = props.mode ?? "detail";
  const width = variant === "modal" ? MODAL_WIDTH : PANEL_WIDTH;
  const contentWidth = width - HORIZONTAL_CHROME;
  const description = props.issue?.description;
  const stateChanges = props.stateChanges;

  // Hooks must run unconditionally, so they precede the no-issue early return.
  // The description body is wrapped/split for the configured width; the activity
  // body renders newest-first (the latest transition is the most relevant) as one
  // line per state change, already short enough to skip the ANSI wrapping.
  const descriptionLines = useMemo(
    () => (description ? splitAnsiIntoLines(markdownToAnsi(description), contentWidth) : []),
    [description, contentWidth],
  );
  const activityLines = useMemo(() => {
    const now = Date.now();
    return (stateChanges ?? []).map((a) => formatStateChange(a, now)).reverse();
  }, [stateChanges]);

  if (!props.issue) {
    return (
      <Box borderStyle="round" paddingX={1} width={width}>
        <Text dimColor>select an issue</Text>
      </Box>
    );
  }
  const i = props.issue;

  // The relations mode renders its own selectable body; the other two share the
  // scroll machinery via resolveBody. Compute the text body regardless (cheap) so
  // the header's scroll counter has its numbers, and pick the body element below.
  const isActivity = mode === "activity";
  const textBody = resolveBody(
    isActivity ? "activity" : "detail",
    isActivity ? activityLines : descriptionLines,
    props,
  );
  const viewportRows = props.viewportRows ?? textBody.lines.length;
  const relationsViewport = Math.max(1, viewportRows);

  return (
    <Box
      flexDirection="column"
      {...frameStyle(variant, theme.accent)}
      paddingX={1}
      width={width}
      height={props.height}
      flexShrink={0}
      overflow="hidden"
    >
      <DetailHeader
        issueKey={i.key}
        mode={mode}
        variant={variant}
        scrollTop={textBody.scrollTop}
        viewportRows={viewportRows}
        total={textBody.lines.length}
      />
      <Text wrap="truncate">{i.name}</Text>
      <IssueMeta issue={i} timeInState={props.timeInState} />
      <DetailBody
        mode={mode}
        textBody={textBody}
        relations={props.relations ?? []}
        relationsSelected={props.relationsSelected ?? 0}
        relationsLoading={props.relationsLoading ?? false}
        relationsViewport={relationsViewport}
      />
    </Box>
  );
}
