import { useEffect, useMemo, useState } from "react";
import type { Issue } from "../types/issue.js";
import type { AppContext } from "../app.js";
import type { FileLogger } from "../utils/file-logger.js";
import type { InkKey } from "../keybindings/key-spec.js";
import { parseQuery, matchesQuery } from "./issue-query.js";

export interface UseIssueFilterOptions {
  // The loaded rows of the active view; the filter narrows these client-side.
  issues: Issue[];
  ctx: AppContext;
  logger: FileLogger;
}

export interface UseIssueFilter {
  // The raw filter string typed in the `/` bar.
  filter: string;
  // True while the filter input is open and consuming keystrokes.
  filtering: boolean;
  // The rows matching the current query (all rows when the query is empty).
  filtered: Issue[];
  // startFilter clears any prior query and opens the input.
  startFilter: () => void;
  // handleKey routes a keystroke while the filter input is open: enter/escape
  // close it; backspace/delete trim; other printable input appends.
  handleKey: (input: string, key: InkKey) => void;
}

// useIssueFilter owns the `/` filter bar: its open/closed state, the typed
// query, and the client-side narrowing of the loaded rows. It also resolves the
// current user once so the `ass:me` token works (a failure is non-fatal —
// ass:me matches nothing until it resolves). Parsing/matching are pure and live
// in issue-query; this hook only holds the state and key handling.
export function useIssueFilter(opts: UseIssueFilterOptions): UseIssueFilter {
  const { issues, ctx, logger } = opts;
  const [filter, setFilter] = useState("");
  const [filtering, setFiltering] = useState(false);

  const [meId, setMeId] = useState<string | undefined>();
  useEffect(() => {
    let cancelled = false;
    ctx.users
      .me()
      .then((u) => {
        if (!cancelled) setMeId(u.id);
      })
      .catch((err: Error) => logger.debug("could not resolve current user", { err }));
    return () => {
      cancelled = true;
    };
  }, [ctx, logger]);

  const queryTerms = useMemo(() => parseQuery(filter), [filter]);
  const filtered = useMemo(() => {
    if (queryTerms.length === 0) return issues;
    return issues.filter((i) => matchesQuery(i, queryTerms, { meId }));
  }, [issues, queryTerms, meId]);

  const startFilter = (): void => {
    setFilter("");
    setFiltering(true);
  };

  const handleKey = (input: string, key: InkKey): void => {
    if (key.return || key.escape) {
      setFiltering(false);
    } else if (key.backspace || key.delete) {
      setFilter((f) => f.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setFilter((f) => f + input);
    }
  };

  return { filter, filtering, filtered, startFilter, handleKey };
}
