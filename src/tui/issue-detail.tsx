import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { Issue } from "../types/issue.js";
import { markdownToAnsi } from "../utils/markdown-to-ansi.js";
import { splitAnsiIntoLines } from "../utils/ansi-lines.js";

export interface IssueDetailProps {
  issue?: Issue;
  loading?: boolean;
  variant?: "panel" | "modal";
  // viewport controls the scrollable description region. Ignored in panel variant.
  scrollTop?: number;
  viewportRows?: number;
  // Total height to lock the modal box into, so the description never spills
  // past the status bar at the bottom of the terminal.
  height?: number;
}

export const MODAL_WIDTH = 100;
export const PANEL_WIDTH = 50;
// Chars of horizontal chrome subtracted from MODAL_WIDTH to get the printable
// area: 2 for the double-border + 2 for paddingX=1 each side.
const HORIZONTAL_CHROME = 4;

// Rows consumed by header + meta block + paddings before the description region.
// Used by the Dashboard to size the scroll viewport against the terminal height.
// 2 border + 2 paddingY + 1 header + 1 name + 1 margin + 5 meta rows + 1 margin
// + 2 for the up/down hints = ~15. We round up a little to leave breathing room.
export const DETAIL_CHROME_ROWS = 16;

export function IssueDetail(props: IssueDetailProps): React.ReactElement {
  const variant = props.variant ?? "panel";
  const width = variant === "modal" ? MODAL_WIDTH : PANEL_WIDTH;
  const contentWidth = width - HORIZONTAL_CHROME;

  if (!props.issue) {
    return (
      <Box borderStyle="round" paddingX={1} width={width}>
        <Text dimColor>select an issue</Text>
      </Box>
    );
  }
  const i = props.issue;

  const rendered = useMemo(
    () => (i.description ? markdownToAnsi(i.description) : ""),
    [i.description],
  );

  const lines = useMemo(
    () => (rendered ? splitAnsiIntoLines(rendered, contentWidth) : []),
    [rendered, contentWidth],
  );

  const viewportRows = props.viewportRows ?? lines.length;
  const maxScroll = Math.max(0, lines.length - viewportRows);
  const scrollTop = Math.max(0, Math.min(props.scrollTop ?? 0, maxScroll));
  const visible = lines.slice(scrollTop, scrollTop + viewportRows);
  const hiddenAbove = scrollTop;
  const hiddenBelow = Math.max(0, lines.length - scrollTop - viewportRows);

  const closeHint =
    variant === "modal"
      ? lines.length > viewportRows
        ? `esc to close · ${scrollTop + 1}-${Math.min(scrollTop + viewportRows, lines.length)}/${lines.length}`
        : "esc to close"
      : "";

  return (
    <Box
      flexDirection="column"
      borderStyle={variant === "modal" ? "double" : "round"}
      borderColor={variant === "modal" ? "cyan" : undefined}
      paddingX={1}
      paddingY={variant === "modal" ? 1 : 0}
      width={width}
      height={props.height}
      flexShrink={0}
      overflow="hidden"
    >
      <Box justifyContent="space-between" flexShrink={0}>
        <Text bold>{i.key}</Text>
        {variant === "modal" ? <Text dimColor>{closeHint}</Text> : null}
      </Box>
      <Text wrap="truncate">{i.name}</Text>
      <Box marginTop={1} flexDirection="column" flexShrink={0}>
        <Text>
          state: <Text color="cyan">{i.state.name}</Text>
        </Text>
        <Text>priority: {i.priority}</Text>
        <Text wrap="truncate">
          assignees: {i.assignees.map((a) => a.display_name).join(", ") || "—"}
        </Text>
        <Text wrap="truncate">labels: {i.labels.map((l) => l.name).join(", ") || "—"}</Text>
        <Text dimColor>updated: {i.updated_at}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column" overflow="hidden">
        {props.loading && !i.description ? (
          <Text dimColor>loading description…</Text>
        ) : lines.length === 0 ? (
          <Text dimColor>(no description)</Text>
        ) : (
          <>
            {hiddenAbove > 0 ? <Text dimColor>↑ {hiddenAbove} more</Text> : null}
            {visible.map((line, idx) => (
              <Text key={`${scrollTop}-${idx}`} wrap="truncate">
                {line.length > 0 ? line : " "}
              </Text>
            ))}
            {hiddenBelow > 0 ? <Text dimColor>↓ {hiddenBelow} more</Text> : null}
          </>
        )}
      </Box>
    </Box>
  );
}
