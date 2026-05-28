import React from "react";
import { Box, Text } from "ink";

export interface StatusBarProps {
  profile: string;
  workspace: string;
  view: string;
  loading: boolean;
  cacheHit?: boolean;
  message?: string;
}

export function StatusBar(props: StatusBarProps): React.ReactElement {
  return (
    <Box justifyContent="space-between" borderStyle="round" paddingX={1}>
      <Text>
        <Text bold>{props.profile}</Text>
        {" · "}
        <Text dimColor>{props.workspace}</Text>
        {" · view: "}
        <Text color="cyan">{props.view}</Text>
      </Text>
      <Text>
        {props.loading ? <Text color="yellow">loading…</Text> : null}
        {props.cacheHit ? <Text color="green"> cache</Text> : null}
        {props.message ? `  ${props.message}` : ""}
        {"  j/k move · enter open · o browser · r refresh · / filter · q quit"}
      </Text>
    </Box>
  );
}
