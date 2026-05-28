import React from "react";
import { Box, Text } from "ink";

export interface ViewSelectorProps {
  views: string[];
  active: number;
}

export function ViewSelector(props: ViewSelectorProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} width={28}>
      <Text bold>Views</Text>
      {props.views.length === 0 ? <Text dimColor>none configured</Text> : null}
      {props.views.map((name, idx) => (
        <Text key={name} color={idx === props.active ? "cyan" : undefined}>
          {idx === props.active ? "› " : "  "}
          {name}
        </Text>
      ))}
    </Box>
  );
}
