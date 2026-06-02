import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { padRight } from "../utils/formatting.js";
import { useTheme } from "./theme/context.js";
import type { ResolvedBinding } from "../keybindings/load.js";
import type { ActionId, ActionContext } from "../keybindings/registry.js";

export interface HelpModalProps {
  bindings: ResolvedBinding[];
  onClose: () => void;
}

const CONTEXT_TITLES: Record<ActionContext, string> = {
  global: "Global",
  list: "Issue list",
  view: "Views",
  filter: "Filter",
  help: "Help modal",
  detail: "Issue detail",
};

// A single help row: one or more key specs that trigger the same behavior, with
// a shared label. `ids` carries the underlying action ids (as plain strings,
// since they come from ResolvedBinding) for the render key and search matching.
interface HelpRow {
  keys: string;
  label: string;
  ids: string[];
  override: boolean;
}

export interface HelpSection {
  title: string;
  rows: HelpRow[];
}

// Vertical navigation is shared between the issue list and the detail view, so
// the help modal collapses both contexts into one "Navigation" section. A row
// is either a single behavior, or a pair of opposite behaviors shown together
// (e.g. "g/G  top / bottom") with the keys and labels joined side by side.
interface NavSide {
  label: string;
  ids: ActionId[];
}
const NAVIGATION_ROWS: { left: NavSide; right?: NavSide }[] = [
  {
    left: {
      label: "move down",
      ids: ["list.next", "list.next-alt", "detail.scroll-down", "detail.scroll-down-alt"],
    },
  },
  {
    left: {
      label: "move up",
      ids: ["list.prev", "list.prev-alt", "detail.scroll-up", "detail.scroll-up-alt"],
    },
  },
  {
    left: { label: "page down", ids: ["list.page-down", "detail.page-down"] },
    right: { label: "page up", ids: ["list.page-up", "detail.page-up"] },
  },
  {
    left: { label: "top", ids: ["list.top", "detail.top"] },
    right: { label: "bottom", ids: ["list.bottom", "detail.bottom"] },
  },
];

const NAVIGATION_IDS = new Set<string>(
  NAVIGATION_ROWS.flatMap((r) => [...r.left.ids, ...(r.right?.ids ?? [])]),
);

// Within a context, these pairs collapse a primary key and its arrow alternate
// into one row (e.g. "]/[" for next/prev view). Keyed by the primary id; values
// are ActionIds. Indexed by plain strings (binding ids), hence the string key.
const ALT_OF: Record<string, ActionId | undefined> = {
  "view.next": "view.next-alt",
  "view.prev": "view.prev-alt",
};
const ALT_IDS = new Set<string>(Object.values(ALT_OF).filter((x): x is ActionId => Boolean(x)));

function joinKeys(bindings: ResolvedBinding[]): string {
  // Preserve the given order; de-duplicate identical key specs.
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const b of bindings) {
    if (!seen.has(b.spec.raw)) {
      seen.add(b.spec.raw);
      keys.push(b.spec.raw);
    }
  }
  return keys.join("/");
}

type Matcher = (b: ResolvedBinding) => boolean;

function makeMatcher(needle: string): Matcher {
  if (!needle) return () => true;
  return (b) =>
    `${b.action.description} ${b.action.id} ${b.spec.raw}`.toLowerCase().includes(needle);
}

// Builds one help row from a set of bindings (already filtered to those shown),
// joining their key specs and ids.
function rowFrom(label: string, bindings: ResolvedBinding[]): HelpRow {
  return {
    keys: joinKeys(bindings),
    label,
    ids: bindings.map((b) => b.action.id),
    override: bindings.some((b) => b.override),
  };
}

// The synthetic Navigation section: shared list/detail vertical nav, with paired
// opposite rows ("g/G  top / bottom") collapsing to whichever side still matches.
function buildNavigationSection(
  byId: Map<string, ResolvedBinding>,
  matches: Matcher,
): HelpSection | undefined {
  const resolveSide = (side: NavSide): ResolvedBinding[] =>
    side.ids
      .map((id) => byId.get(id))
      .filter((b): b is ResolvedBinding => b !== undefined && matches(b));

  const rows: HelpRow[] = [];
  for (const row of NAVIGATION_ROWS) {
    const sides = [
      { label: row.left.label, bindings: resolveSide(row.left) },
      row.right ? { label: row.right.label, bindings: resolveSide(row.right) } : undefined,
    ].filter((s) => s !== undefined && s.bindings.length > 0);
    if (sides.length === 0) continue;
    rows.push({
      keys: sides.map((s) => joinKeys(s!.bindings)).join("/"),
      label: sides.map((s) => s!.label).join(" / "),
      ids: sides.flatMap((s) => s!.bindings.map((b) => b.action.id)),
      override: sides.some((s) => s!.bindings.some((b) => b.override)),
    });
  }
  return rows.length > 0 ? { title: "Navigation", rows } : undefined;
}

// Remaining actions grouped by context, skipping navigation (shown above) and
// alt keys that merge into their primary's row.
function buildContextSections(
  bindings: ResolvedBinding[],
  byId: Map<string, ResolvedBinding>,
  matches: Matcher,
): HelpSection[] {
  const grouped = new Map<ActionContext, HelpRow[]>();
  for (const b of bindings) {
    if (NAVIGATION_IDS.has(b.action.id) || ALT_IDS.has(b.action.id)) continue;
    const alt = ALT_OF[b.action.id];
    const full = [b, alt ? byId.get(alt) : undefined].filter((x): x is ResolvedBinding =>
      Boolean(x),
    );
    const shown = full.filter(matches);
    if (shown.length === 0) continue;
    const rows = grouped.get(b.action.context) ?? [];
    rows.push(rowFrom(b.action.description, shown));
    grouped.set(b.action.context, rows);
  }
  return Array.from(grouped, ([context, rows]) => ({ title: CONTEXT_TITLES[context], rows }));
}

// buildHelpSections is exported so it can be unit-tested without a renderer.
export function buildHelpSections(bindings: ResolvedBinding[], query: string): HelpSection[] {
  const matches = makeMatcher(query.trim().toLowerCase());
  const byId = new Map<string, ResolvedBinding>();
  for (const b of bindings) byId.set(b.action.id, b);

  const nav = buildNavigationSection(byId, matches);
  return [...(nav ? [nav] : []), ...buildContextSections(bindings, byId, matches)];
}

export function HelpModal(props: HelpModalProps): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const sections = useMemo(() => buildHelpSections(props.bindings, query), [props.bindings, query]);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      props.onClose();
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      return;
    }
    // typing inside the modal goes into the search box
    if (input && !key.ctrl && !key.meta && input !== "?") {
      setQuery((q) => q + input);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.accent}
      paddingX={2}
      paddingY={1}
      width={80}
    >
      <Box justifyContent="space-between">
        <Text bold color={theme.accent}>
          Keybindings
        </Text>
        <Text dimColor>esc/q to close</Text>
      </Box>
      <Box marginTop={1}>
        <Text>search: </Text>
        <Text color={theme.accent}>{query || " "}</Text>
        <Text dimColor>_</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {sections.length === 0 ? (
          <Text dimColor>no matches</Text>
        ) : (
          sections.map((section) => (
            <Box key={section.title} flexDirection="column" marginTop={1}>
              <Text bold color={theme.warning}>
                {section.title}
              </Text>
              {section.rows.map((row) => (
                <Box key={row.ids.join(",")}>
                  <Text>{padRight(row.keys, 14)}</Text>
                  <Text dimColor>{row.label}</Text>
                  {row.override ? <Text color={theme.success}> *</Text> : null}
                </Box>
              ))}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
