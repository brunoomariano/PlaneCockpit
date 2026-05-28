import React from "react";
import { Box, Text } from "ink";
import type { Issue } from "../types/issue.js";
import { priorityMarker, truncate } from "../utils/formatting.js";
import { SkeletonRows } from "./skeleton.js";

export interface IssueListProps {
  issues: Issue[];
  selected: number;
  filter: string;
  viewportRows: number;
  loading?: boolean;
}

const PRIORITY_COLOR = {
  urgent: "redBright",
  high: "red",
  medium: "yellow",
  low: "green",
  none: "gray",
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
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} flexGrow={1}>
      <Box>
        <Text bold>{padRight("KEY", 12)}</Text>
        <Text bold>{padRight("P", 3)}</Text>
        <Text bold>{padRight("STATE", 14)}</Text>
        <Text bold>TITLE</Text>
      </Box>
      {hiddenAbove > 0 ? <Text dimColor>↑ {hiddenAbove} more</Text> : null}
      {visible.map((issue, offset) => {
        const idx = start + offset;
        const isSelected = idx === props.selected;
        return (
          <Box key={issue.id}>
            <Text color={isSelected ? "cyan" : undefined} inverse={isSelected}>
              {padRight(issue.key, 12)}
              <Text color={PRIORITY_COLOR[issue.priority]}>
                {padRight(priorityMarker(issue.priority), 3)}
              </Text>
              {padRight(issue.state.name, 14)}
              {truncate(issue.name, 60)}
            </Text>
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

function padRight(value: string | undefined | null, width: number): string {
  const v = value ?? "";
  if (v.length >= width) return `${v.slice(0, width - 1)} `;
  return v + " ".repeat(width - v.length);
}
