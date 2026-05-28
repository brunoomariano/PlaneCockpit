import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";

export interface SkeletonRowsProps {
  rows: number;
  // columnWidths follows the IssueList header: KEY (12), P (3), STATE (14), TITLE (rest).
  columnWidths?: [number, number, number, number];
}

const DEFAULT_WIDTHS: [number, number, number, number] = [12, 8, 14, 40];
const BLOCK = "▒";

// useShimmerFrame returns a frame index that ticks ~3 times per second.
// We use it to slide a brighter run across the placeholder line so the skeleton
// looks alive instead of static. The animation runs while the component is mounted.
function useShimmerFrame(): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 120);
    return () => clearInterval(id);
  }, []);
  return frame;
}

function shimmerLine(width: number, frame: number, offset: number): string {
  if (width <= 0) return "";
  const cycle = width + 8;
  const head = (frame * 2 + offset) % cycle;
  let out = "";
  for (let i = 0; i < width; i++) {
    const distance = Math.abs(i - head);
    out += distance < 3 ? "█" : BLOCK;
  }
  return out;
}

export function SkeletonRows(props: SkeletonRowsProps): React.ReactElement {
  const widths = props.columnWidths ?? DEFAULT_WIDTHS;
  const frame = useShimmerFrame();
  const rows = Math.max(0, props.rows);
  return (
    <Box flexDirection="column">
      <Box>
        <Text bold dimColor>
          {pad("KEY", widths[0])}
        </Text>
        <Text bold dimColor>
          {pad("PRIORITY", widths[1])}
        </Text>
        <Text bold dimColor>
          {pad("STATE", widths[2])}
        </Text>
        <Text bold dimColor>
          TITLE
        </Text>
      </Box>
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i}>
          <Text dimColor>{shimmerLine(widths[0] - 1, frame, i * 2) + " "}</Text>
          <Text dimColor>{shimmerLine(widths[1] - 1, frame, i * 2 + 1) + " "}</Text>
          <Text dimColor>{shimmerLine(widths[2] - 1, frame, i * 2 + 2) + " "}</Text>
          <Text dimColor>{shimmerLine(widths[3], frame, i * 2 + 3)}</Text>
        </Box>
      ))}
    </Box>
  );
}

function pad(value: string, width: number): string {
  if (value.length >= width) return `${value.slice(0, width - 1)} `;
  return value + " ".repeat(width - value.length);
}
