import React from "react";
import { Box, Text } from "ink";
import type { FileLogger } from "../utils/file-logger.js";

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
    return (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text color="red" bold>
          render error: {this.state.error.message}
        </Text>
        <Text dimColor>see {this.props.logger.filePath} — press q to quit</Text>
      </Box>
    );
  }
}
