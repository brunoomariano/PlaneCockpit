import React from "react";
import { Box, Text } from "ink";
import type { Issue } from "../types/issue.js";

export interface IssueDetailProps {
  issue?: Issue;
}

export function IssueDetail(props: IssueDetailProps): React.ReactElement {
  if (!props.issue) {
    return (
      <Box borderStyle="round" paddingX={1} width={40}>
        <Text dimColor>select an issue</Text>
      </Box>
    );
  }
  const i = props.issue;
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} width={40}>
      <Text bold>{i.key}</Text>
      <Text>{i.name}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>state: <Text color="cyan">{i.state.name}</Text></Text>
        <Text>priority: {i.priority}</Text>
        <Text>assignees: {i.assignees.map((a) => a.display_name).join(", ") || "—"}</Text>
        <Text>labels: {i.labels.map((l) => l.name).join(", ") || "—"}</Text>
        <Text dimColor>updated: {i.updated_at}</Text>
      </Box>
      {i.description ? (
        <Box marginTop={1}>
          <Text>{i.description}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
