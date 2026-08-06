import { useStdout } from "./opentui-primitives.js";

// TerminalSize is the current terminal dimensions in rows and columns.
export interface TerminalSize {
  rows: number;
  columns: number;
}

// useTerminalSize tracks the terminal dimensions, updating on resize. It seeds
// from the current stdout (falling back to 24x80 when unavailable, e.g. a piped
// or test stream) and keeps the listener bound to the live stdout handle.
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  return { rows: stdout.rows, columns: stdout.columns };
}
