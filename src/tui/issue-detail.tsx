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
}

export const MODAL_WIDTH = 100;
export const PANEL_WIDTH = 50;
const INNER_PADDING = 2;

// Rows consumed by header + meta block + paddings before the description region.
// Used by the Dashboard to size the scroll viewport against the terminal height.
export const DETAIL_CHROME_ROWS = 14;

export function IssueDetail(props: IssueDetailProps): React.ReactElement {
  const variant = props.variant ?? "panel";
  const width = variant === "modal" ? MODAL_WIDTH : PANEL_WIDTH;
  const contentWidth = width - INNER_PADDING;

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
    >
      <Box justifyContent="space-between">
        <Text bold>{i.key}</Text>
        {variant === "modal" ? <Text dimColor>{closeHint}</Text> : null}
      </Box>
      <Text>{i.name}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          state: <Text color="cyan">{i.state.name}</Text>
        </Text>
        <Text>priority: {i.priority}</Text>
        <Text>assignees: {i.assignees.map((a) => a.display_name).join(", ") || "—"}</Text>
        <Text>labels: {i.labels.map((l) => l.name).join(", ") || "—"}</Text>
        <Text dimColor>updated: {i.updated_at}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {props.loading && !i.description ? (
          <Text dimColor>loading description…</Text>
        ) : lines.length === 0 ? (
          <Text dimColor>(no description)</Text>
        ) : (
          <>
            {hiddenAbove > 0 ? <Text dimColor>↑ {hiddenAbove} more</Text> : null}
            {visible.map((line, idx) => (
              <Text key={`${scrollTop}-${idx}`}>{line.length > 0 ? line : " "}</Text>
            ))}
            {hiddenBelow > 0 ? <Text dimColor>↓ {hiddenBelow} more</Text> : null}
          </>
        )}
      </Box>
    </Box>
  );
}
