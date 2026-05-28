import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import type { Issue } from "../types/issue.js";
import type { AppContext } from "../app.js";
import { StatusBar } from "./status-bar.js";
import { ViewSelector } from "./view-selector.js";
import { IssueList } from "./issue-list.js";
import { IssueDetail, DETAIL_CHROME_ROWS } from "./issue-detail.js";
import { FilterBox } from "./filter-box.js";
import { HelpModal } from "./help-modal.js";
import { buildIssueUrl } from "../utils/urls.js";
import { defaultBrowserOpener } from "../utils/browser.js";
import type { FileLogger } from "../utils/file-logger.js";
import { dispatch } from "../keybindings/dispatcher.js";
import type { ActionId } from "../keybindings/registry.js";

export interface DashboardProps {
  ctx: AppContext;
  logger: FileLogger;
}

type Panel = "list" | "detail";

export function Dashboard({ ctx, logger }: DashboardProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = useState(stdout?.rows ?? 24);
  useEffect(() => {
    if (!stdout) return;
    const onResize = (): void => setTerminalRows(stdout.rows ?? 24);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const views = useMemo(() => ctx.runtime.profile.views ?? [], [ctx]);
  const [viewIdx, setViewIdx] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [filtering, setFiltering] = useState(false);
  const [filter, setFilter] = useState("");
  const [panel, setPanel] = useState<Panel>("list");
  const [helpOpen, setHelpOpen] = useState(false);
  // detailed holds the full issue (with description) fetched via retrieve(). It
  // resets when the selection changes; we keep one entry at a time because the
  // detail panel only shows one issue.
  const [detailed, setDetailed] = useState<Issue | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailScroll, setDetailScroll] = useState(0);

  const activeView = views[viewIdx];

  const load = useCallback(async () => {
    if (!activeView) {
      logger.warn("no active view to load (profile has no views configured)");
      return;
    }
    setLoading(true);
    setError(undefined);
    // Clear the previous list so the user sees the skeleton appear immediately
    // rather than stale rows from a different view.
    setIssues([]);
    setSelected(0);
    logger.debug("loading view", { view: activeView.name, project: activeView.project });
    try {
      const data = await ctx.issues.list(activeView.project, activeView, activeView.limit ?? 100);
      setIssues(data);
      setSelected(0);
      logger.debug("view loaded", { view: activeView.name, count: data.length });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      logger.error("view load failed", { view: activeView.name, err: err as Error });
    } finally {
      setLoading(false);
    }
  }, [ctx, activeView, logger]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    logger.info("dashboard started", {
      profile: ctx.runtime.profile_name,
      workspace: ctx.runtime.profile.server.workspace_slug,
      views: views.length,
    });
    if (views.length === 0) {
      setError("no views configured — add `views:` to your profile in config.yaml");
    }
  }, [ctx, views, logger]);

  const filtered = useMemo(() => {
    if (!filter) return issues;
    const needle = filter.toLowerCase();
    return issues.filter(
      (i) => i.name.toLowerCase().includes(needle) || i.key.toLowerCase().includes(needle),
    );
  }, [issues, filter]);

  const currentSummary = filtered[selected];

  // Fetch full issue (with description) only when the detail panel is visible.
  // The list endpoint omits description_*, so the body needs an extra retrieve.
  useEffect(() => {
    if (panel !== "detail" || !currentSummary) {
      setDetailed(undefined);
      return;
    }
    // Each time a new issue's detail opens, reset the description scroll so the
    // user starts at the top instead of carrying the previous scroll position.
    setDetailScroll(0);
    let cancelled = false;
    setDetailLoading(true);
    const project = {
      id: currentSummary.project_id,
      identifier: currentSummary.project_identifier,
      name: "",
      workspace_id: "",
    };
    ctx.workItems
      .retrieve(project, currentSummary.id)
      .then((full) => {
        if (cancelled) return;
        setDetailed(full);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        logger.error("retrieve issue failed", { issue: currentSummary.key, err });
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [panel, currentSummary, ctx, logger]);

  // Reserve rows for status bar (3), list header + border (4), optional filter box (3),
  // and the "↑ N more" / "↓ N more" hints (2). Keep a floor so the list never disappears.
  const reservedRows = 9 + (filtering ? 3 : 0) + (filter ? 1 : 0);
  const viewportRows = Math.max(3, terminalRows - reservedRows);

  // Detail modal viewport. The modal box itself is sized to fill the terminal
  // minus the status bar, and the description region inside it gets whatever is
  // left after the chrome (header + meta + paddings + hints).
  const STATUS_BAR_ROWS = 3;
  const detailModalHeight = Math.max(DETAIL_CHROME_ROWS + 3, terminalRows - STATUS_BAR_ROWS);
  const detailViewportRows = Math.max(3, detailModalHeight - DETAIL_CHROME_ROWS);

  const openSelectedInBrowser = useCallback(() => {
    const issue = filtered[selected];
    if (!issue) return;
    try {
      const url = buildIssueUrl(ctx.runtime.profile.server, { id: issue.id }, undefined);
      void defaultBrowserOpener.open(url).catch((err) => {
        logger.error("failed to open browser", { url, err: err as Error });
      });
    } catch (err) {
      logger.error("failed to build issue url", { issue: issue.key, err: err as Error });
      setError((err as Error).message);
    }
  }, [filtered, selected, ctx, logger]);

  const handlers: Partial<Record<ActionId, () => void>> = {
    "global.quit": () => exit(),
    "global.refresh": () => void load(),
    "global.help": () => setHelpOpen((open) => !open),
    "list.next": () => setSelected((s) => Math.min(filtered.length - 1, s + 1)),
    "list.next-alt": () => setSelected((s) => Math.min(filtered.length - 1, s + 1)),
    "list.prev": () => setSelected((s) => Math.max(0, s - 1)),
    "list.prev-alt": () => setSelected((s) => Math.max(0, s - 1)),
    "list.page-down": () => setSelected((s) => Math.min(filtered.length - 1, s + viewportRows)),
    "list.page-up": () => setSelected((s) => Math.max(0, s - viewportRows)),
    "list.top": () => setSelected(0),
    "list.bottom": () => setSelected(Math.max(0, filtered.length - 1)),
    "list.open-detail": () => setPanel("detail"),
    "list.open-browser": openSelectedInBrowser,
    "list.toggle-panel": () => setPanel((p) => (p === "list" ? "detail" : "list")),
    "view.next": () => setViewIdx((i) => Math.min(views.length - 1, i + 1)),
    "view.next-alt": () => setViewIdx((i) => Math.min(views.length - 1, i + 1)),
    "view.prev": () => setViewIdx((i) => Math.max(0, i - 1)),
    "view.prev-alt": () => setViewIdx((i) => Math.max(0, i - 1)),
    "filter.start": () => {
      setFilter("");
      setFiltering(true);
    },
  };

  useInput((input, key) => {
    if (helpOpen) {
      // Help modal owns input until closed. close on the configured key or 'q'.
      const consumed = dispatch(
        ctx.keybindings,
        ["help"],
        { "help.close": () => setHelpOpen(false) },
        input,
        key,
      );
      if (consumed) return;
      if (input === "q" || key.escape) setHelpOpen(false);
      return;
    }
    if (panel === "detail") {
      // Detail modal: scroll the description with j/k/PgUp/PgDn/g/G, leave on Esc.
      const detailHandlers: Partial<Record<ActionId, () => void>> = {
        "detail.close": () => setPanel("list"),
        "detail.scroll-down": () => setDetailScroll((s) => s + 1),
        "detail.scroll-down-alt": () => setDetailScroll((s) => s + 1),
        "detail.scroll-up": () => setDetailScroll((s) => Math.max(0, s - 1)),
        "detail.scroll-up-alt": () => setDetailScroll((s) => Math.max(0, s - 1)),
        "detail.page-down": () => setDetailScroll((s) => s + detailViewportRows),
        "detail.page-up": () => setDetailScroll((s) => Math.max(0, s - detailViewportRows)),
        "detail.top": () => setDetailScroll(0),
        "detail.bottom": () => setDetailScroll(Number.MAX_SAFE_INTEGER),
        "detail.open-browser": openSelectedInBrowser,
        "global.help": () => setHelpOpen((open) => !open),
        "global.refresh": () => void load(),
        "global.quit": () => setPanel("list"),
      };
      dispatch(ctx.keybindings, ["detail", "global"], detailHandlers, input, key);
      return;
    }
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
    dispatch(ctx.keybindings, ["global", "list", "view", "filter"], handlers, input, key);
  });

  const current = detailed ?? currentSummary;

  if (helpOpen) {
    // Ink has no absolute positioning, so the modal effect is achieved by replacing
    // the main content with a centered, bordered HelpModal that fills the terminal.
    return (
      <Box flexDirection="column" height={terminalRows}>
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <HelpModal bindings={ctx.keybindings} onClose={() => setHelpOpen(false)} />
        </Box>
        <StatusBar
          profile={ctx.runtime.profile_name}
          workspace={ctx.runtime.profile.server.workspace_slug}
          view={activeView?.name ?? "—"}
          loading={loading}
          message={error}
          position={filtered.length > 0 ? `${selected + 1}/${filtered.length}` : undefined}
        />
      </Box>
    );
  }

  if (panel === "detail") {
    return (
      <Box flexDirection="column" height={terminalRows}>
        <Box flexGrow={1} justifyContent="center" alignItems="flex-start" overflow="hidden">
          <IssueDetail
            issue={current}
            loading={detailLoading}
            variant="modal"
            scrollTop={detailScroll}
            viewportRows={detailViewportRows}
            height={detailModalHeight}
          />
        </Box>
        <StatusBar
          profile={ctx.runtime.profile_name}
          workspace={ctx.runtime.profile.server.workspace_slug}
          view={activeView?.name ?? "—"}
          loading={detailLoading}
          message={error}
          position={current ? `${selected + 1}/${filtered.length}` : undefined}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <ViewSelector views={views.map((v) => v.name)} active={viewIdx} />
        <Box flexDirection="column" flexGrow={1}>
          <IssueList
            issues={filtered}
            selected={selected}
            filter={filter}
            viewportRows={viewportRows}
            loading={loading}
          />
          <FilterBox active={filtering} value={filter} />
        </Box>
      </Box>
      <StatusBar
        profile={ctx.runtime.profile_name}
        workspace={ctx.runtime.profile.server.workspace_slug}
        view={activeView?.name ?? "—"}
        loading={loading}
        message={error}
        position={filtered.length > 0 ? `${selected + 1}/${filtered.length}` : undefined}
      />
    </Box>
  );
}
