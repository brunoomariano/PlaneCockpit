import React from "react";
import { Box, Text } from "ink";
import type { FileLogger } from "../utils/file-logger.js";
import { ThemeContext } from "./theme/context.js";

interface Props {
  logger: FileLogger;
  children: React.ReactNode;
}

interface State {
  error?: Error;
}

// ErrorBoundary catches render-time exceptions thrown by Ink components, which would
// otherwise crash the TUI with a stack trace mixed into the terminal canvas. The error
// is written to the file logger and rendered in a degraded view so the user can quit
// cleanly and inspect the log.
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.logger.error("tui render error", {
      err: error,
      componentStack: info.componentStack,
    });
  }

  override render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message;
    const filePath = this.props.logger.filePath;
    // Read danger from the theme via Consumer (class component can't use the
    // hook). Fall back to a literal when no provider is present so the crash view
    // renders even if a missing/broken theme is the cause of the error.
    return (
      <ThemeContext.Consumer>
        {(theme) => (
          <Box flexDirection="column" borderStyle="round" paddingX={1}>
            <Text color={theme?.danger ?? "red"} bold>
              render error: {message}
            </Text>
            <Text dimColor>see {filePath} — press q to quit</Text>
          </Box>
        )}
      </ThemeContext.Consumer>
    );
  }
}
