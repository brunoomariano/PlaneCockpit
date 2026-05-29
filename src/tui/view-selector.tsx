import React from "react";
import { Box, Text } from "ink";

export interface ViewEntry {
  name: string;
  // Marker '#': the view restricts projects (declares its own subset instead of
  // using the defaults.projects globals).
  restricted: boolean;
  // Marker '*' (red): the view config references projects that are not in
  // defaults.projects. The invalid ones are ignored; the marker flags the error.
  hasErrors: boolean;
}

export interface ViewSelectorProps {
  // Global projects declared in defaults.projects, shown in the config container
  // above the views list.
  defaultProjects: string[];
  views: ViewEntry[];
  active: number;
}

export function ViewSelector(props: ViewSelectorProps): React.ReactElement {
  return (
    <Box flexDirection="column" width={28}>
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>Config</Text>
        <Text>
          <Text dimColor>projects: </Text>
          {props.defaultProjects.length === 0 ? (
            <Text dimColor>none</Text>
          ) : (
            <Text color="cyan">{props.defaultProjects.join(", ")}</Text>
          )}
        </Text>
        <Text dimColor># = view restricts projects</Text>
        <Text>
          <Text color="red">*</Text>
          <Text dimColor> = error in view config</Text>
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>Views</Text>
        {props.views.length === 0 ? <Text dimColor>none configured</Text> : null}
        {props.views.map((view, idx) => {
          const isActive = idx === props.active;
          return (
            <Text key={view.name} color={isActive ? "cyan" : undefined}>
              {isActive ? "› " : "  "}
              {view.hasErrors ? <Text color="red">* </Text> : null}
              {view.restricted ? <Text dimColor># </Text> : null}
              {view.name}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
