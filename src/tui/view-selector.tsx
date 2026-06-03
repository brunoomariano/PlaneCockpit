import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "./theme/context.js";

export interface ViewEntry {
  name: string;
  // Marker '#': the view restricts projects (declares its own subset instead of
  // using the defaults.projects globals).
  restricted: boolean;
  // Marker '*' (red): the view config references projects that are not in
  // defaults.projects. The invalid ones are ignored; the marker flags the error.
  hasErrors: boolean;
  // Number of items currently loaded for the view, shown beside its name. When
  // the view has never loaded it is undefined (no count yet).
  count?: number;
  // True while a fetch for the view is in flight: the count is replaced by a
  // small loading indicator so the user sees which views are refreshing.
  loading?: boolean;
}

// SPINNER cycles a braille frame so the in-flight indicator next to a view name
// looks alive instead of static. Ticks ~8 times per second while mounted.
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

function useSpinnerFrame(): string {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 120);
    return () => clearInterval(id);
  }, []);
  return SPINNER[frame % SPINNER.length]!;
}

// ViewCount renders the trailing badge for a view: a spinner while loading, the
// item count once loaded, or nothing before the first load.
function ViewCount(props: { entry: ViewEntry; spinner: string }): React.ReactElement | null {
  const theme = useTheme();
  if (props.entry.loading) return <Text color={theme.accent}> {props.spinner}</Text>;
  if (props.entry.count === undefined) return null;
  return <Text dimColor> ({props.entry.count})</Text>;
}

// Width of the fixed side panel in the wide layout. Exported so the dashboard
// can subtract it when sizing the issue list's available width.
export const SIDE_PANEL_WIDTH = 28;

export interface ViewSelectorProps {
  // Global projects declared in defaults.projects, shown in the config container
  // above the views list.
  defaultProjects: string[];
  views: ViewEntry[];
  active: number;
  // horizontal renders a compact, full-width bar meant to sit on top of the list
  // on narrow terminals, instead of the tall fixed-width side column.
  horizontal?: boolean;
}

export function ViewSelector(props: ViewSelectorProps): React.ReactElement {
  const theme = useTheme();
  const spinner = useSpinnerFrame();
  if (props.horizontal) return <HorizontalViewSelector {...props} />;
  return (
    <Box flexDirection="column" width={SIDE_PANEL_WIDTH} flexShrink={0}>
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>Config</Text>
        <Text>
          <Text dimColor>projects: </Text>
          {props.defaultProjects.length === 0 ? (
            <Text dimColor>none</Text>
          ) : (
            <Text color={theme.accent}>{props.defaultProjects.join(", ")}</Text>
          )}
        </Text>
        <Text dimColor># = view restricts projects</Text>
        <Text>
          <Text color={theme.danger}>*</Text>
          <Text dimColor> = error in view config</Text>
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>Views</Text>
        {props.views.length === 0 ? <Text dimColor>none configured</Text> : null}
        {props.views.map((view, idx) => {
          const isActive = idx === props.active;
          return (
            <Text key={view.name} color={isActive ? theme.accent : undefined}>
              {isActive ? "› " : "  "}
              {view.hasErrors ? <Text color={theme.danger}>* </Text> : null}
              {view.restricted ? <Text dimColor># </Text> : null}
              {view.name}
              <ViewCount entry={view} spinner={spinner} />
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}

// HorizontalViewSelector is the narrow-terminal layout: a compact full-width
// panel that sits on top of the list. It keeps the same info as the side panel
// (projects summary + views with their markers) but folds it onto two truncating
// lines so it costs minimal vertical space.
function HorizontalViewSelector(props: ViewSelectorProps): React.ReactElement {
  const theme = useTheme();
  const spinner = useSpinnerFrame();
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} flexShrink={0}>
      {/* Each row is one Text with wrap="truncate" so it clips on overflow
          instead of wrapping into the border. */}
      <Text wrap="truncate">
        <Text dimColor>projects: </Text>
        {props.defaultProjects.length === 0 ? (
          <Text dimColor>none</Text>
        ) : (
          <Text color={theme.accent}>{props.defaultProjects.join(", ")}</Text>
        )}
      </Text>
      <Text wrap="truncate">
        <Text dimColor>views: </Text>
        {props.views.length === 0 ? <Text dimColor>none configured</Text> : null}
        {props.views.map((view, idx) => {
          const isActive = idx === props.active;
          return (
            <Text key={view.name} color={isActive ? theme.accent : undefined}>
              {isActive ? "›" : " "}
              {view.hasErrors ? <Text color={theme.danger}>*</Text> : null}
              {view.restricted ? <Text dimColor>#</Text> : null}
              {view.name}
              <ViewCount entry={view} spinner={spinner} />
              {idx < props.views.length - 1 ? <Text dimColor>{"  "}</Text> : null}
            </Text>
          );
        })}
      </Text>
    </Box>
  );
}
