import Table from "cli-table3";
import YAML from "yaml";
import type { Issue, IssuePriority } from "../types/issue.js";

export type OutputFormat = "table" | "json" | "yaml";

export function pickOutputFormat(flags: { json?: boolean; yaml?: boolean }): OutputFormat {
  if (flags.json) return "json";
  if (flags.yaml) return "yaml";
  return "table";
}

// Width of the priority column. `urgent` is the longest label at 6 chars; `—`
// for `none` keeps the column visually anchored when priority is missing.
export const PRIORITY_COLUMN_WIDTH = 6;

// Fixed width of the TITLE column so every row's title fills the same span up to
// the ASSIGN column on the right, keeping the table edge aligned regardless of
// how long individual titles are. The +2 accounts for cli-table3 cell padding.
export const TITLE_COLUMN_WIDTH = 60;

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  urgent: "URGENT",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  none: "—",
};

export function priorityLabel(p: IssuePriority): string {
  return PRIORITY_LABEL[p];
}

export function renderIssues(issues: Issue[], fmt: OutputFormat): string {
  if (fmt === "json") return JSON.stringify(issues, null, 2);
  if (fmt === "yaml") return YAML.stringify(issues);
  const table = new Table({
    head: ["KEY", "PRIORITY", "STATE", "TITLE", "ASSIGN"],
    style: { head: ["cyan"] },
    // TITLE is pinned to a fixed width so titles fill the span up to ASSIGN and
    // the ASSIGN column lands at a consistent right edge across all rows. The +2
    // mirrors cli-table3's per-cell padding so content gets the full width.
    colWidths: [null, PRIORITY_COLUMN_WIDTH + 4, null, TITLE_COLUMN_WIDTH + 2, null],
    colAligns: ["left", "center", "left", "left", "left"],
  });
  for (const issue of issues) {
    table.push([
      issue.key,
      priorityLabel(issue.priority),
      issue.state.name,
      padRight(truncate(issue.name, TITLE_COLUMN_WIDTH), TITLE_COLUMN_WIDTH),
      issue.assignees.map((a) => a.display_name).join(", "),
    ]);
  }
  return table.toString();
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function renderAny(value: unknown, fmt: OutputFormat): string {
  if (fmt === "json") return JSON.stringify(value, null, 2);
  if (fmt === "yaml") return YAML.stringify(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

// A single entity cannot be a table, so render it as yaml in table mode. Use for
// command output that returns one object rather than a list.
export function renderObject(value: unknown, fmt: OutputFormat): string {
  return renderAny(value, fmt === "table" ? "yaml" : fmt);
}

// Pads `value` to `width`, truncating with a trailing space when it overflows.
export function padRight(value: string | undefined | null, width: number): string {
  const v = value ?? "";
  if (v.length >= width) return `${v.slice(0, width - 1)} `;
  return v + " ".repeat(width - v.length);
}

// Right-aligns `value` within `width` by padding spaces on the left, truncating
// (no ellipsis) when it overflows. Complements padRight (left-align) / padCenter.
export function padLeft(value: string | undefined | null, width: number): string {
  const v = value ?? "";
  if (v.length >= width) return v.slice(0, width);
  return " ".repeat(width - v.length) + v;
}

// Centers `value` within `width`, truncating (no ellipsis) when it overflows.
export function padCenter(value: string | undefined | null, width: number): string {
  const v = value ?? "";
  if (v.length >= width) return v.slice(0, width);
  const remaining = width - v.length;
  const left = Math.floor(remaining / 2);
  return " ".repeat(left) + v + " ".repeat(remaining - left);
}
