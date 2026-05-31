import React from "react";
import { Box, Text } from "ink";
import type { Issue } from "../types/issue.js";
import { priorityLabel, PRIORITY_COLUMN_WIDTH, truncate, padCenter } from "../utils/formatting.js";
import { SkeletonRows } from "./skeleton.js";

export interface IssueListProps {
  issues: Issue[];
  selected: number;
  filter: string;
  viewportRows: number;
  // width is the terminal column count; columns size against it so rows never
  // wrap (wrapping corrupts the table and breaks the fixed header).
  width: number;
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

export interface IssueColumns {
  title: number;
  priorityWidth: number;
  compactPriority: boolean;
  showState: boolean;
  showAssign: boolean;
}

// issueColumns derives the responsive column layout from the list's available
// width. TITLE absorbs the leftover space; as width shrinks the layout degrades
// in order: drop STATE, then drop ASSIGN, then collapse PRIORITY to a single
// letter. ASSIGN outlives STATE because assignees are the column users most want
// to keep visible. TITLE always keeps a readable minimum so rows never wrap.
//
// Each layout is a row of fixed column widths; titleFor() returns the space left
// for TITLE after those columns and the 1-col gap between each. A layout is used
// when its TITLE still meets MIN_TITLE_WIDTH.
export function issueColumns(width: number): IssueColumns {
  const inner = Math.max(0, width - LIST_CHROME_COLS);
  // Space left for TITLE after the given fixed columns plus a 1-col gap per cell.
  const titleFor = (fixed: number[]): number =>
    inner - fixed.reduce((a, b) => a + b, 0) - fixed.length;

  const layouts: IssueColumns[] = [
    {
      title: titleFor([KEY_WIDTH, PRIORITY_WIDTH, STATE_WIDTH, ASSIGN_WIDTH]),
      priorityWidth: PRIORITY_WIDTH,
      compactPriority: false,
      showState: true,
      showAssign: true,
    },
    {
      title: titleFor([KEY_WIDTH, PRIORITY_WIDTH, ASSIGN_WIDTH]),
      priorityWidth: PRIORITY_WIDTH,
      compactPriority: false,
      showState: false,
      showAssign: true,
    },
    {
      title: titleFor([KEY_WIDTH, PRIORITY_WIDTH]),
      priorityWidth: PRIORITY_WIDTH,
      compactPriority: false,
      showState: false,
      showAssign: false,
    },
  ];
  const chosen = layouts.find((l) => l.title >= MIN_TITLE_WIDTH);
  if (chosen) return chosen;

  // Tightest layout: single-letter priority, no STATE/ASSIGN; floor the title.
  return {
    title: Math.max(MIN_TITLE_WIDTH, titleFor([KEY_WIDTH, PRIORITY_COMPACT_WIDTH])),
    priorityWidth: PRIORITY_COMPACT_WIDTH,
    compactPriority: true,
    showState: false,
    showAssign: false,
  };
}

// assignLabel renders the assignees for the ASSIGN column: joined display names,
// truncated to the column width. Empty when unassigned so the column reads blank.
export function assignLabel(issue: Issue, width: number): string {
  if (issue.assignees.length === 0) return "";
  return truncate(issue.assignees.map((a) => a.display_name).join(", "), width);
}

const PRIORITY_COLOR = {
  urgent: "red",
  high: "#ff8700", // orange (Ink maps hex to the nearest terminal color)
  medium: "yellow",
  low: "green",
  none: "gray",
} as const;

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
  const startRef = React.useRef(0);
  if (props.loading) {
    // Hide the previous content during a fetch. The skeleton mirrors the column
    // layout so the eye doesn't have to re-anchor when results arrive.
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
  const cols = issueColumns(props.width);
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} flexGrow={1}>
      {/* Each cell is a fixed-width Box with flexShrink={0} (title flex-grows) so
          columns never shrink into each other; a 1-col gap separates them. The
          fixed widths already reserve room for that gap (padCenter/truncate). */}
      <Box columnGap={1}>
        <Box width={KEY_WIDTH} flexShrink={0}>
          <Text bold>KEY</Text>
        </Box>
        <Box width={cols.priorityWidth} flexShrink={0}>
          <Text bold>{cols.compactPriority ? "PR" : "PRIORITY"}</Text>
        </Box>
        {cols.showState ? (
          <Box width={STATE_WIDTH} flexShrink={0}>
            <Text bold>STATE</Text>
          </Box>
        ) : null}
        <Box flexGrow={1}>
          <Text bold>TITLE</Text>
        </Box>
        {cols.showAssign ? (
          <Box width={ASSIGN_WIDTH} flexShrink={0}>
            <Text bold>ASSIGN</Text>
          </Box>
        ) : null}
      </Box>
      {hiddenAbove > 0 ? <Text dimColor>↑ {hiddenAbove} more</Text> : null}
      {visible.map((issue, offset) => {
        const idx = start + offset;
        const isSelected = idx === props.selected;
        const color = isSelected ? "cyan" : undefined;
        const priorityText = cols.compactPriority
          ? PRIORITY_LETTER[issue.priority]
          : priorityLabel(issue.priority);
        return (
          <Box key={issue.id} columnGap={1}>
            <Box width={KEY_WIDTH} flexShrink={0}>
              <Text color={color} inverse={isSelected} wrap="truncate">
                {issue.key}
              </Text>
            </Box>
            <Box width={cols.priorityWidth} flexShrink={0}>
              <Text
                color={isSelected ? color : PRIORITY_COLOR[issue.priority]}
                inverse={isSelected}
              >
                {cols.compactPriority ? priorityText : padCenter(priorityText, cols.priorityWidth)}
              </Text>
            </Box>
            {cols.showState ? (
              <Box width={STATE_WIDTH} flexShrink={0}>
                <Text color={color} inverse={isSelected} wrap="truncate">
                  {issue.state.name}
                </Text>
              </Box>
            ) : null}
            <Box flexGrow={1}>
              <Text color={color} inverse={isSelected} wrap="truncate">
                {issue.name}
              </Text>
            </Box>
            {cols.showAssign ? (
              <Box width={ASSIGN_WIDTH} flexShrink={0}>
                <Text color={color} inverse={isSelected} wrap="truncate">
                  {assignLabel(issue, ASSIGN_WIDTH)}
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
