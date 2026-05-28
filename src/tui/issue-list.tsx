import React from "react";
import { Box, Text } from "ink";
import type { Issue } from "../types/issue.js";
import { priorityMarker, truncate } from "../utils/formatting.js";

export interface IssueListProps {
  issues: Issue[];
  selected: number;
  filter: string;
}

const PRIORITY_COLOR = {
  urgent: "redBright",
  high: "red",
  medium: "yellow",
  low: "green",
  none: "gray",
} as const;

export function IssueList(props: IssueListProps): React.ReactElement {
  if (props.issues.length === 0) {
    return (
      <Box borderStyle="round" paddingX={1} flexGrow={1}>
        <Text dimColor>no issues to show</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} flexGrow={1}>
      <Box>
        <Text bold>{padRight("KEY", 12)}</Text>
        <Text bold>{padRight("P", 3)}</Text>
        <Text bold>{padRight("STATE", 14)}</Text>
        <Text bold>TITLE</Text>
      </Box>
      {props.issues.map((issue, idx) => (
        <Box key={issue.id}>
          <Text
            color={idx === props.selected ? "cyan" : undefined}
            inverse={idx === props.selected}
          >
            {padRight(issue.key, 12)}
            <Text color={PRIORITY_COLOR[issue.priority]}>{padRight(priorityMarker(issue.priority), 3)}</Text>
            {padRight(issue.state.name, 14)}
            {truncate(issue.name, 60)}
          </Text>
        </Box>
      ))}
      {props.filter ? (
        <Box marginTop={1}>
          <Text dimColor>filter: {props.filter}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function padRight(value: string, width: number): string {
  if (value.length >= width) return `${value.slice(0, width - 1)} `;
  return value + " ".repeat(width - value.length);
}
