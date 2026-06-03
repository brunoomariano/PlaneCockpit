import React from "react";
import { Box, Text } from "ink";
import type { Issue } from "../types/issue.js";
import type { ColumnAlign, ColumnId, ViewLayout } from "../types/views.js";
import {
  priorityLabel,
  PRIORITY_COLUMN_WIDTH,
  truncate,
  padCenter,
  padLeft,
  padRight,
} from "../utils/formatting.js";
import { SkeletonRows } from "./skeleton.js";
import { useTheme } from "./theme/context.js";

export interface IssueListProps {
  issues: Issue[];
  selected: number;
  filter: string;
  viewportRows: number;
  // width is the terminal column count; columns size against it so rows never
  // wrap (wrapping corrupts the table and breaks the fixed header).
  width: number;
  // Resolved per-column layout intent (view.layout ?? defaults.layout). Absent ⇒
  // the solver uses its built-in responsive constants.
  layout?: ViewLayout;
  loading?: boolean;
}

const KEY_WIDTH = 12;
const PRIORITY_WIDTH = PRIORITY_COLUMN_WIDTH + 4;
// Compact PRIORITY collapses to a single letter (U/H/M/L/·) on narrow terminals.
const PRIORITY_COMPACT_WIDTH = 3;
const STATE_WIDTH = 14;
const ASSIGN_WIDTH = 16;
// Box border (2) + paddingX (2). Subtracted from terminal width before laying
// out columns so the content never exceeds the inner width and wraps.
const LIST_CHROME_COLS = 4;
const MIN_TITLE_WIDTH = 12;

const DEFAULT_ALIGN: Record<ColumnId, ColumnAlign> = {
  key: "left",
  priority: "center",
  state: "left",
  title: "left",
  assign: "left",
};

export interface IssueColumns {
  title: number;
  keyWidth: number;
  priorityWidth: number;
  stateWidth: number;
  assignWidth: number;
  compactPriority: boolean;
  showState: boolean;
  showAssign: boolean;
  // Which column absorbs leftover width. "title" unless the layout grows another.
  growColumn: ColumnId;
  // Resolved alignment per column, for the renderer to apply.
  align: Record<ColumnId, ColumnAlign>;
}

// resolveLayout picks the effective layout for a view: the view's own layout
// wins; otherwise the profile's defaults.layout; with neither, an empty layout
// (the solver then uses its built-in constants). A view's layout replaces the
// default wholesale — columns are never merged.
export function resolveLayout(
  viewLayout: ViewLayout | undefined,
  defaultsLayout: ViewLayout | undefined,
): ViewLayout {
  return viewLayout ?? defaultsLayout ?? {};
}

// One degradation step the solver may pick, richest to tightest.
interface Candidate {
  priorityWidth: number;
  compactPriority: boolean;
  showState: boolean;
  showAssign: boolean;
}

// ColumnSpec is the layout resolved into concrete numbers/flags, independent of
// terminal width. The solver then fits it to the width.
interface ColumnSpec {
  keyWidth: number;
  priorityFull: number;
  stateWidth: number;
  assignWidth: number;
  titleFixed: number;
  growColumn: ColumnId;
  align: Record<ColumnId, ColumnAlign>;
  candidates: Candidate[];
}

// resolveAligns fills every column's alignment, falling back to its default.
function resolveAligns(layout: ViewLayout): Record<ColumnId, ColumnAlign> {
  const ids: ColumnId[] = ["key", "priority", "state", "title", "assign"];
  return Object.fromEntries(
    ids.map((id) => [id, layout[id]?.align ?? DEFAULT_ALIGN[id]]),
  ) as Record<ColumnId, ColumnAlign>;
}

// Fixed widths per column, each overridable by the layout's configured width.
function resolveWidths(layout: ViewLayout): {
  key: number;
  priority: number;
  state: number;
  assign: number;
  title: number;
} {
  const widthOf = (id: ColumnId, fallback: number): number => layout[id]?.width ?? fallback;
  return {
    key: widthOf("key", KEY_WIDTH),
    priority: widthOf("priority", PRIORITY_WIDTH),
    state: widthOf("state", STATE_WIDTH),
    assign: widthOf("assign", ASSIGN_WIDTH),
    title: widthOf("title", MIN_TITLE_WIDTH),
  };
}

// resolveColumnSpec turns the layout intent into concrete widths, the grow
// column, alignments, and the degradation candidates. A configured `width`
// overrides the column constant; `hidden` drops STATE/ASSIGN; the grow column
// defaults to TITLE.
function resolveColumnSpec(layout: ViewLayout): ColumnSpec {
  const w = resolveWidths(layout);
  const showState = layout.state?.hidden !== true;
  const showAssign = layout.assign?.hidden !== true;
  const growColumn =
    (Object.keys(layout) as ColumnId[]).find((id) => layout[id]?.grow === true) ?? "title";

  return {
    keyWidth: w.key,
    priorityFull: w.priority,
    stateWidth: w.state,
    assignWidth: w.assign,
    titleFixed: w.title,
    growColumn,
    align: resolveAligns(layout),
    candidates: [
      { priorityWidth: w.priority, compactPriority: false, showState, showAssign },
      { priorityWidth: w.priority, compactPriority: false, showState: false, showAssign },
      { priorityWidth: w.priority, compactPriority: false, showState: false, showAssign: false },
      {
        priorityWidth: PRIORITY_COMPACT_WIDTH,
        compactPriority: true,
        showState: false,
        showAssign: false,
      },
    ],
  };
}

// issueColumns derives the responsive column layout from the list's available
// width, seeded by the resolved `layout` intent. The grow column (TITLE by
// default) absorbs leftover space; as width shrinks the layout degrades in
// order: drop STATE, then ASSIGN, then collapse PRIORITY to a single letter. A
// `hidden` column never renders; a configured `width` overrides the constant.
// The grow column always keeps MIN_TITLE_WIDTH so rows never wrap — a pinned
// width can never force an overflow.
export function issueColumns(width: number, layout: ViewLayout = {}): IssueColumns {
  const inner = Math.max(0, width - LIST_CHROME_COLS);
  const spec = resolveColumnSpec(layout);
  const { keyWidth, stateWidth, assignWidth, titleFixed, growColumn, align } = spec;

  // Space left for the grow column after the given fixed columns plus a 1-col
  // gap per rendered cell.
  const growFor = (fixed: number[]): number =>
    inner - fixed.reduce((a, b) => a + b, 0) - fixed.length;

  // Fixed columns for a candidate are everything shown except the grow column.
  const fixedWidths = (c: Candidate): number[] =>
    (
      [
        { id: "key", w: keyWidth, shown: true },
        { id: "priority", w: c.priorityWidth, shown: true },
        { id: "state", w: stateWidth, shown: c.showState },
        { id: "title", w: titleFixed, shown: true },
        { id: "assign", w: assignWidth, shown: c.showAssign },
      ] satisfies { id: ColumnId; w: number; shown: boolean }[]
    )
      .filter((p) => p.shown && p.id !== growColumn)
      .map((p) => p.w);

  const build = (c: Candidate, grow: number): IssueColumns => ({
    title: growColumn === "title" ? grow : titleFixed,
    keyWidth,
    priorityWidth: c.priorityWidth,
    stateWidth,
    assignWidth: growColumn === "assign" ? grow : assignWidth,
    compactPriority: c.compactPriority,
    showState: c.showState,
    showAssign: c.showAssign,
    growColumn,
    align,
  });

  // Pick the richest candidate whose grow column still meets MIN_TITLE_WIDTH;
  // otherwise the tightest, with the grow column floored so rows never wrap (Ink
  // truncates per cell even if the floor nominally exceeds the inner width).
  const fitting = spec.candidates.find((c) => growFor(fixedWidths(c)) >= MIN_TITLE_WIDTH);
  if (fitting) return build(fitting, growFor(fixedWidths(fitting)));
  const tightest = spec.candidates[spec.candidates.length - 1]!;
  return build(tightest, Math.max(MIN_TITLE_WIDTH, growFor(fixedWidths(tightest))));
}

// alignText pads `value` to `width` per the column's alignment. left = pad right
// (padRight), center = padCenter, right = pad left (padLeft). Used for fixed
// columns; the grow column relies on Ink's flex-grow + truncate instead.
function alignText(value: string, width: number, align: ColumnAlign): string {
  if (align === "center") return padCenter(value, width);
  if (align === "right") return padLeft(value, width);
  return padRight(value, width);
}

// assignLabel renders the assignees for the ASSIGN column: joined display names,
// truncated to the column width. Empty when unassigned so the column reads blank.
export function assignLabel(issue: Issue, width: number): string {
  if (issue.assignees.length === 0) return "";
  return truncate(issue.assignees.map((a) => a.display_name).join(", "), width);
}

// Single-letter priority labels for the compact column ('·' for none).
const PRIORITY_LETTER = {
  urgent: "U",
  high: "H",
  medium: "M",
  low: "L",
  none: "·",
} as const;

// computeViewport keeps `selected` inside the visible window [start, start+rows).
// When the cursor leaves the window, the window scrolls just enough to bring it back.
export function computeViewport(
  total: number,
  selected: number,
  rows: number,
  previousStart = 0,
): { start: number; end: number } {
  if (rows <= 0 || total === 0) return { start: 0, end: 0 };
  if (rows >= total) return { start: 0, end: total };
  let start = previousStart;
  if (selected < start) start = selected;
  else if (selected >= start + rows) start = selected - rows + 1;
  start = Math.max(0, Math.min(start, total - rows));
  return { start, end: start + rows };
}

export function IssueList(props: IssueListProps): React.ReactElement {
  const theme = useTheme();
  const startRef = React.useRef(0);
  if (props.loading && props.issues.length === 0) {
    // Skeleton only when there is nothing to show yet (first load of a view).
    // On a refresh we keep the previous rows on screen and update them in place
    // once the new data arrives, so the list never blanks out under the cursor.
    const skeletonRows = Math.max(3, Math.min(props.viewportRows, 12));
    return (
      <Box borderStyle="round" paddingX={1} flexGrow={1} flexDirection="column">
        <SkeletonRows rows={skeletonRows} />
      </Box>
    );
  }
  if (props.issues.length === 0) {
    return (
      <Box borderStyle="round" paddingX={1} flexGrow={1}>
        <Text dimColor>no issues to show</Text>
      </Box>
    );
  }
  const { start, end } = computeViewport(
    props.issues.length,
    props.selected,
    props.viewportRows,
    startRef.current,
  );
  startRef.current = start;
  const visible = props.issues.slice(start, end);
  const hiddenAbove = start;
  const hiddenBelow = props.issues.length - end;
  const cols = issueColumns(props.width, props.layout);

  // Box props for a column: the grow column flex-grows, the rest are fixed width.
  const cell = (
    id: ColumnId,
    width: number,
  ): { width?: number; flexGrow?: number; flexShrink?: number } =>
    cols.growColumn === id ? { flexGrow: 1 } : { width, flexShrink: 0 };
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} flexGrow={1}>
      {/* Each cell is a fixed-width Box with flexShrink={0}; the grow column
          flex-grows so columns never shrink into each other. A 1-col gap
          separates them; the fixed widths reserve room for it. */}
      <Box columnGap={1}>
        <Box {...cell("key", cols.keyWidth)}>
          <Text bold>{alignText("KEY", cols.keyWidth, cols.align.key)}</Text>
        </Box>
        <Box {...cell("priority", cols.priorityWidth)}>
          <Text bold>{cols.compactPriority ? "PR" : "PRIORITY"}</Text>
        </Box>
        {cols.showState ? (
          <Box {...cell("state", cols.stateWidth)}>
            <Text bold>STATE</Text>
          </Box>
        ) : null}
        <Box {...cell("title", cols.title)}>
          <Text bold>TITLE</Text>
        </Box>
        {cols.showAssign ? (
          <Box {...cell("assign", cols.assignWidth)}>
            <Text bold>ASSIGN</Text>
          </Box>
        ) : null}
      </Box>
      {hiddenAbove > 0 ? <Text dimColor>↑ {hiddenAbove} more</Text> : null}
      {visible.map((issue, offset) => {
        const idx = start + offset;
        const isSelected = idx === props.selected;
        const color = isSelected ? theme.selection : undefined;
        const priorityText = cols.compactPriority
          ? PRIORITY_LETTER[issue.priority]
          : priorityLabel(issue.priority);
        return (
          <Box key={issue.id} columnGap={1}>
            <Box {...cell("key", cols.keyWidth)}>
              <Text color={color} inverse={isSelected} wrap="truncate">
                {alignText(issue.key, cols.keyWidth, cols.align.key)}
              </Text>
            </Box>
            <Box {...cell("priority", cols.priorityWidth)}>
              <Text
                color={isSelected ? color : theme.priority[issue.priority]}
                inverse={isSelected}
              >
                {cols.compactPriority
                  ? priorityText
                  : alignText(priorityText, cols.priorityWidth, cols.align.priority)}
              </Text>
            </Box>
            {cols.showState ? (
              <Box {...cell("state", cols.stateWidth)}>
                <Text color={color} inverse={isSelected} wrap="truncate">
                  {alignText(issue.state.name, cols.stateWidth, cols.align.state)}
                </Text>
              </Box>
            ) : null}
            <Box {...cell("title", cols.title)}>
              <Text color={color} inverse={isSelected} wrap="truncate">
                {issue.name}
              </Text>
            </Box>
            {cols.showAssign ? (
              <Box {...cell("assign", cols.assignWidth)}>
                <Text color={color} inverse={isSelected} wrap="truncate">
                  {alignText(
                    assignLabel(issue, cols.assignWidth),
                    cols.assignWidth,
                    cols.align.assign,
                  )}
                </Text>
              </Box>
            ) : null}
          </Box>
        );
      })}
      {hiddenBelow > 0 ? <Text dimColor>↓ {hiddenBelow} more</Text> : null}
      {props.filter ? (
        <Box marginTop={1}>
          <Text dimColor>filter: {props.filter}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
