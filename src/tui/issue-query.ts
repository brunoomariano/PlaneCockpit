import type { Issue } from "../types/issue.js";

// QueryTerm is one parsed token of the filter bar. `key` selects the field a
// token matches; a bare word is `text` (title/key substring, the legacy
// behaviour). Enum-ish fields (group/priority/project) match exactly; name
// fields (assignee/state/label) and text match case-insensitive substrings.
type QueryKey = "text" | "ass" | "state" | "group" | "prio" | "label" | "proj";

export interface QueryTerm {
  key: QueryKey;
  value: string;
}

const KEYS: QueryKey[] = ["ass", "state", "group", "prio", "label", "proj"];

// parseQuery splits the raw filter string into terms. `key:value` tokens with a
// recognised key become typed terms; everything else (bare words, or a `key:`
// with an unknown key) is a `text` term, so a stray colon never eats the query.
// Whitespace separates tokens; empty input yields no terms (matches everything).
export function parseQuery(input: string): QueryTerm[] {
  const terms: QueryTerm[] = [];
  for (const token of input.split(/\s+/)) {
    if (token.length === 0) continue;
    const colon = token.indexOf(":");
    if (colon > 0) {
      const key = token.slice(0, colon).toLowerCase();
      const value = token.slice(colon + 1);
      if ((KEYS as string[]).includes(key) && value.length > 0) {
        terms.push({ key: key as QueryKey, value });
        continue;
      }
    }
    terms.push({ key: "text", value: token });
  }
  return terms;
}

export interface MatchContext {
  // The current user's id, so `ass:me` can resolve to it. Undefined when unknown.
  meId?: string;
}

function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// matchesTerm reports whether a single term matches the issue. Name fields use a
// case-insensitive substring; group/priority/project match exactly (lowercased);
// `ass:me` resolves to the context's meId.
function matchesTerm(issue: Issue, term: QueryTerm, ctx: MatchContext): boolean {
  const v = term.value;
  switch (term.key) {
    case "text":
      return includesCI(issue.name, v) || includesCI(issue.key, v);
    case "ass":
      if (v.toLowerCase() === "me")
        return ctx.meId ? issue.assignees.some((a) => a.id === ctx.meId) : false;
      return issue.assignees.some((a) => includesCI(a.display_name, v));
    case "state":
      return includesCI(issue.state.name, v);
    case "group":
      return issue.state.group.toLowerCase() === v.toLowerCase();
    case "prio":
      return issue.priority.toLowerCase() === v.toLowerCase();
    case "label":
      return issue.labels.some((l) => includesCI(l.name, v));
    case "proj":
      return issue.project_identifier.toLowerCase() === v.toLowerCase();
  }
}

// matchesQuery applies the parsed terms to an issue: terms of different keys
// combine with AND, while repeated terms of the same key combine with OR (so
// `label:bug label:ui` keeps issues with either label). No terms matches all.
export function matchesQuery(issue: Issue, terms: QueryTerm[], ctx: MatchContext = {}): boolean {
  if (terms.length === 0) return true;
  const byKey = new Map<QueryKey, QueryTerm[]>();
  for (const term of terms) {
    const group = byKey.get(term.key) ?? [];
    group.push(term);
    byKey.set(term.key, group);
  }
  for (const group of byKey.values()) {
    if (!group.some((term) => matchesTerm(issue, term, ctx))) return false;
  }
  return true;
}

// formatListPosition builds the status-bar position text for the list panel.
// With a filter active it always reports the match count — even zero, so an
// over-narrow query reads as "filtered" rather than "no data" (`0 of N`). With
// matches it shows the cursor position and, when filtering, the match suffix.
// No filter and no rows yields undefined (the status bar omits the segment).
export function formatListPosition(opts: {
  selected: number;
  matched: number;
  total: number;
  filtering: boolean;
}): string | undefined {
  const { selected, matched, total, filtering } = opts;
  if (matched > 0) {
    const suffix = filtering ? ` (${matched} of ${total})` : "";
    return `${selected + 1}/${matched}${suffix}`;
  }
  return filtering ? `0 of ${total}` : undefined;
}
