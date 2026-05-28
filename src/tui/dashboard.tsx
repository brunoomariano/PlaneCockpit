import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, useApp, useInput } from "ink";
import type { Issue } from "../types/issue.js";
import type { AppContext } from "../app.js";
import { StatusBar } from "./status-bar.js";
import { ViewSelector } from "./view-selector.js";
import { IssueList } from "./issue-list.js";
import { IssueDetail } from "./issue-detail.js";
import { FilterBox } from "./filter-box.js";
import { buildIssueUrl } from "../utils/urls.js";
import { defaultBrowserOpener } from "../utils/browser.js";

export interface DashboardProps {
  ctx: AppContext;
}

type Panel = "list" | "detail";

export function Dashboard({ ctx }: DashboardProps): React.ReactElement {
  const { exit } = useApp();
  const views = useMemo(() => ctx.runtime.profile.views ?? [], [ctx]);
  const [viewIdx, setViewIdx] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [filtering, setFiltering] = useState(false);
  const [filter, setFilter] = useState("");
  const [panel, setPanel] = useState<Panel>("list");

  const activeView = views[viewIdx];

  const load = useCallback(async () => {
    if (!activeView) return;
    setLoading(true);
    setError(undefined);
    try {
      const data = await ctx.issues.list(activeView.project, activeView, activeView.limit ?? 100);
      setIssues(data);
      setSelected(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ctx, activeView]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!filter) return issues;
    const needle = filter.toLowerCase();
    return issues.filter(
      (i) => i.name.toLowerCase().includes(needle) || i.key.toLowerCase().includes(needle),
    );
  }, [issues, filter]);

  useInput((input, key) => {
    if (filtering) {
      if (key.return || key.escape) {
        setFiltering(false);
        return;
      }
      if (key.backspace || key.delete) {
        setFilter((f) => f.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) setFilter((f) => f + input);
      return;
    }
    if (input === "q" || key.escape) exit();
    if (input === "j" || key.downArrow) setSelected((s) => Math.min(filtered.length - 1, s + 1));
    if (input === "k" || key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.tab) setPanel((p) => (p === "list" ? "detail" : "list"));
    if (input === "r") load();
    if (input === "/") {
      setFilter("");
      setFiltering(true);
    }
    if (input === "[" || key.leftArrow) setViewIdx((i) => Math.max(0, i - 1));
    if (input === "]" || key.rightArrow) setViewIdx((i) => Math.min(views.length - 1, i + 1));
    if (key.return) setPanel("detail");
    if (input === "o" && filtered[selected]) {
      const issue = filtered[selected];
      const url = buildIssueUrl(ctx.runtime.profile.server, { id: issue.id }, undefined);
      void defaultBrowserOpener.open(url);
    }
  });

  const current = filtered[selected];

  return (
    <Box flexDirection="column">
      <Box>
        <ViewSelector views={views.map((v) => v.name)} active={viewIdx} />
        <Box flexDirection="column" flexGrow={1}>
          <IssueList issues={filtered} selected={selected} filter={filter} />
          <FilterBox active={filtering} value={filter} />
        </Box>
        {panel === "detail" ? <IssueDetail issue={current} /> : null}
      </Box>
      <StatusBar
        profile={ctx.runtime.profile_name}
        workspace={ctx.runtime.profile.server.workspace_slug}
        view={activeView?.name ?? "—"}
        loading={loading}
        message={error}
      />
    </Box>
  );
}
