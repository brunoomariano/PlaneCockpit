import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { Issue } from "../types/issue.js";
import { markdownToAnsi } from "../utils/markdown-to-ansi.js";

export interface IssueDetailProps {
  issue?: Issue;
  loading?: boolean;
  variant?: "panel" | "modal";
}

export function IssueDetail(props: IssueDetailProps): React.ReactElement {
  const variant = props.variant ?? "panel";
  const width = variant === "modal" ? 100 : 50;
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
        {variant === "modal" ? <Text dimColor>esc to close</Text> : null}
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
        ) : rendered ? (
          <Text>{rendered}</Text>
        ) : (
          <Text dimColor>(no description)</Text>
        )}
      </Box>
    </Box>
  );
}
