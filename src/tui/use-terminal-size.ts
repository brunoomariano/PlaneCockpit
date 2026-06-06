import { useEffect, useState } from "react";
import { useStdout } from "ink";

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
  const [size, setSize] = useState<TerminalSize>({
    rows: stdout?.rows ?? 24,
    columns: stdout?.columns ?? 80,
  });
  useEffect(() => {
    if (!stdout) return;
    const onResize = (): void => {
      setSize({ rows: stdout.rows ?? 24, columns: stdout.columns ?? 80 });
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  return size;
}
