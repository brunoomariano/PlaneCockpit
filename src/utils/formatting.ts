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

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  urgent: "urgent",
  high: "high",
  medium: "medium",
  low: "low",
  none: "—",
};

export function priorityLabel(p: IssuePriority): string {
  return PRIORITY_LABEL[p];
}

export function renderIssues(issues: Issue[], fmt: OutputFormat): string {
  if (fmt === "json") return JSON.stringify(issues, null, 2);
  if (fmt === "yaml") return YAML.stringify(issues);
  const table = new Table({
    head: ["KEY", "PRIORITY", "STATE", "TITLE", "ASSIGNEES"],
    style: { head: ["cyan"] },
    colWidths: [null, PRIORITY_COLUMN_WIDTH + 4, null, null, null],
  });
  for (const issue of issues) {
    table.push([
      issue.key,
      priorityLabel(issue.priority),
      issue.state.name,
      truncate(issue.name, 60),
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
