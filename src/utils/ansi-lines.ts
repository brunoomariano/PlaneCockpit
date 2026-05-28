// Utilities for splitting ANSI-decorated text into wrapped lines that fit a given
// column width. The terminal width counts only printable characters — ANSI escape
// sequences are zero-width but must be preserved or colors leak across lines.

// strips CSI (Control Sequence Introducer) escapes used for colors/styles.
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function visibleWidth(text: string): number {
  return text.replace(ANSI_RE, "").length;
}

// wrapAnsiLine breaks a single logical line into chunks that fit `width` columns
// without splitting ANSI escapes. Plain ASCII only — multi-byte width (CJK) is
// out of scope. When width <= 0 the input is returned untouched in a single chunk.
export function wrapAnsiLine(line: string, width: number): string[] {
  if (width <= 0 || visibleWidth(line) <= width) return [line];
  const out: string[] = [];
  let buffer = "";
  let visible = 0;
  let i = 0;
  while (i < line.length) {
    const ansi = readAnsi(line, i);
    if (ansi) {
      buffer += ansi;
      i += ansi.length;
      continue;
    }
    buffer += line[i];
    visible += 1;
    i += 1;
    if (visible >= width) {
      out.push(buffer);
      buffer = "";
      visible = 0;
    }
  }
  if (buffer.length > 0) out.push(buffer);
  return out;
}

function readAnsi(line: string, at: number): string | null {
  if (line[at] !== "\x1b") return null;
  if (line[at + 1] !== "[") return null;
  let j = at + 2;
  while (j < line.length && line[j] !== "m") j += 1;
  if (j >= line.length) return null;
  return line.slice(at, j + 1);
}

// splitAnsiIntoLines turns an ANSI-rendered string into a flat array of visual
// rows. Newlines are honored as hard breaks; long rows are soft-wrapped to `width`.
export function splitAnsiIntoLines(text: string, width: number): string[] {
  if (text.length === 0) return [];
  const rows: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.length === 0) {
      rows.push("");
      continue;
    }
    rows.push(...wrapAnsiLine(raw, width));
  }
  return rows;
}
