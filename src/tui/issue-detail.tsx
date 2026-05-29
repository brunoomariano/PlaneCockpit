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

// The fixed metadata block (state, priority, assignees, labels, updated).
function IssueMeta({ issue }: { issue: Issue }): React.ReactElement {
  return (
    <Box marginTop={1} flexDirection="column" flexShrink={0}>
      <Text>
        state: <Text color="cyan">{issue.state.name}</Text>
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

interface DescriptionBodyProps {
  loading: boolean;
  hasDescription: boolean;
  visible: string[];
  hiddenAbove: number;
  hiddenBelow: number;
  scrollTop: number;
}

// The scrollable description region with the "N more" hints above/below.
function DescriptionBody(props: DescriptionBodyProps): React.ReactElement {
  let content: React.ReactNode;
  if (props.loading && !props.hasDescription) {
    content = <Text dimColor>loading description…</Text>;
  } else if (props.visible.length === 0 && props.hiddenAbove === 0 && props.hiddenBelow === 0) {
    content = <Text dimColor>(no description)</Text>;
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

function closeHintFor(scrollTop: number, viewportRows: number, total: number): string {
  if (total <= viewportRows) return "esc to close";
  const end = Math.min(scrollTop + viewportRows, total);
  return `esc to close · ${scrollTop + 1}-${end}/${total}`;
}

export function IssueDetail(props: IssueDetailProps): React.ReactElement {
  const variant = props.variant ?? "panel";
  const width = variant === "modal" ? MODAL_WIDTH : PANEL_WIDTH;
  const contentWidth = width - HORIZONTAL_CHROME;
  const description = props.issue?.description;

  // Hooks must run unconditionally, so they precede the no-issue early return.
  const rendered = useMemo(() => (description ? markdownToAnsi(description) : ""), [description]);
  const lines = useMemo(
    () => (rendered ? splitAnsiIntoLines(rendered, contentWidth) : []),
    [rendered, contentWidth],
  );

  if (!props.issue) {
    return (
      <Box borderStyle="round" paddingX={1} width={width}>
        <Text dimColor>select an issue</Text>
      </Box>
    );
  }
  const i = props.issue;

  const viewportRows = props.viewportRows ?? lines.length;
  const scrollTop = Math.max(
    0,
    Math.min(props.scrollTop ?? 0, Math.max(0, lines.length - viewportRows)),
  );
  const visible = lines.slice(scrollTop, scrollTop + viewportRows);

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
        {variant === "modal" ? (
          <Text dimColor>{closeHintFor(scrollTop, viewportRows, lines.length)}</Text>
        ) : null}
      </Box>
      <Text wrap="truncate">{i.name}</Text>
      <IssueMeta issue={i} />
      <DescriptionBody
        loading={props.loading ?? false}
        hasDescription={Boolean(i.description)}
        visible={visible}
        hiddenAbove={scrollTop}
        hiddenBelow={Math.max(0, lines.length - scrollTop - viewportRows)}
        scrollTop={scrollTop}
      />
    </Box>
  );
}
