import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Dashboard } from "../tui/dashboard.js";
import type { AppContext } from "../app.js";
import type { Issue } from "../types/issue.js";
import { resolveBindings } from "../keybindings/load.js";
import type { FileLogger } from "../utils/file-logger.js";
import { ThemeProvider } from "../tui/theme/context.js";
import { PRESETS } from "../tui/theme/presets.js";

// Renders the Dashboard wrapped in a ThemeProvider, mirroring how the dash
// command composes the tree, so components calling useTheme have a theme.
function renderDashboard(ctx: AppContext, logger: FileLogger): ReturnType<typeof render> {
  const dashboard = React.createElement(Dashboard, { ctx, logger });
  return render(
    React.createElement(ThemeProvider, { theme: PRESETS.default, children: dashboard }),
  );
}

const tick = (ms = 120): Promise<void> => new Promise((r) => setTimeout(r, ms));

function issue(key: string): Issue {
  return {
    id: `id-${key}`,
    sequence_id: 1,
    project_id: "p1",
    project_identifier: "ENG",
    key,
    name: `title ${key}`,
    state: { id: "s", name: "Todo", group: "unstarted" },
    priority: "none",
    assignees: [],
    labels: [],
    created_at: "",
    updated_at: "",
  };
}

function silentLogger(): FileLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as FileLogger;
}

// A deferred promise lets a test hold a fetch in the "in flight" state so we can
// assert what the dashboard shows while loading (skeleton vs. previous rows).
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function baseCtx(list: ReturnType<typeof vi.fn>, views: { name: string }[]): AppContext {
  return {
    runtime: {
      profile_name: "test",
      no_cache: false,
      profile: {
        server: { base_url: "https://x", workspace_slug: "acme" },
        defaults: { projects: ["ENG"], auto_refresh_seconds: 0 },
        views,
      },
    },
    issues: { list },
    workItems: { retrieve: vi.fn().mockResolvedValue(issue("ENG-1")) },
    users: {},
    keybindings: resolveBindings({}),
    theme: PRESETS.default,
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppContext;
}

describe("dashboard refresh + per-view counts (e2e)", () => {
  // The skeleton (shimmer block) appears only before the first successful load.
  // Once data arrives a manual refresh keeps the rows on screen and only the
  // navbar count is swapped for a spinner.
  it("shows the skeleton only before the first load, then keeps rows on refresh", async () => {
    const first = deferred<Issue[]>();
    const list = vi.fn().mockReturnValueOnce(first.promise);
    const { lastFrame, stdin, unmount } = renderDashboard(
      baseCtx(list, [{ name: "All" }]),
      silentLogger(),
    );

    // First load is in flight: nothing loaded yet, so the skeleton shows.
    await tick(20);
    expect(lastFrame()).toContain("▒");
    expect(lastFrame()).not.toContain("title ENG-1");

    first.resolve([issue("ENG-1"), issue("ENG-2")]);
    await tick();
    expect(lastFrame()).toContain("title ENG-1");
    expect(lastFrame()).not.toContain("▒");

    // A refresh keeps the previous rows visible while the new fetch is in flight.
    const second = deferred<Issue[]>();
    list.mockReturnValueOnce(second.promise);
    stdin.write("r");
    await tick(20);
    expect(lastFrame()).toContain("title ENG-1"); // rows preserved, no skeleton
    expect(lastFrame()).not.toContain("▒");

    second.resolve([issue("ENG-1"), issue("ENG-2"), issue("ENG-3")]);
    await tick();
    expect(lastFrame()).toContain("title ENG-3");
    unmount();
  });

  // The navbar shows the item count beside each view's name once it has loaded.
  it("renders the loaded item count beside the active view", async () => {
    const list = vi.fn().mockResolvedValue([issue("ENG-1"), issue("ENG-2")]);
    const { lastFrame, unmount } = renderDashboard(
      baseCtx(list, [{ name: "All" }]),
      silentLogger(),
    );
    await tick();
    expect(lastFrame()).toContain("(2)");
    unmount();
  });

  // 'R' (shift+r) refreshes every configured view, not just the active one.
  it("refreshes all views on R", async () => {
    const list = vi.fn().mockResolvedValue([issue("ENG-1")]);
    const { stdin, unmount } = renderDashboard(
      baseCtx(list, [{ name: "All" }, { name: "Mine" }, { name: "Done" }]),
      silentLogger(),
    );
    await tick(); // only the active view loads on startup
    expect(list).toHaveBeenCalledTimes(1);

    stdin.write("R");
    await tick();
    // One call per view on top of the initial active-view load.
    expect(list).toHaveBeenCalledTimes(1 + 3);
    unmount();
  });

  // 'R' throttles the fan-out: with more views than the concurrency cap (3), no
  // more than 3 fetches are in flight at once instead of all of them at once.
  it("caps concurrent fetches when refreshing all views with R", async () => {
    let inFlight = 0;
    let peak = 0;
    const list = vi.fn().mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 30));
      inFlight--;
      return [issue("ENG-1")];
    });
    const views = ["A", "B", "C", "D", "E"].map((name) => ({ name }));
    const { stdin, unmount } = renderDashboard(baseCtx(list, views), silentLogger());
    await tick(60); // let the initial active-view load settle

    peak = 0; // measure only the refresh-all burst
    stdin.write("R");
    await tick(120);
    expect(peak).toBe(3);
    expect(list).toHaveBeenCalledTimes(1 + 5);
    unmount();
  });

  // Regression: overlapping refreshes on the same view must abort the previous
  // in-flight fetch instead of piling up open connections (which timed out
  // against a slow self-hosted Plane). The first fetch's signal is aborted the
  // moment a second refresh starts.
  it("aborts the previous in-flight fetch when a refresh supersedes it", async () => {
    const first = deferred<Issue[]>();
    const signals: (AbortSignal | undefined)[] = [];
    const list = vi
      .fn()
      .mockImplementation((_projects, _view, _limit, _sort, signal?: AbortSignal) => {
        signals.push(signal);
        // Keep the first fetch pending so the second can supersede it; later
        // calls resolve immediately.
        return signals.length === 1 ? first.promise : Promise.resolve([issue("ENG-1")]);
      });
    const { stdin, unmount } = renderDashboard(baseCtx(list, [{ name: "All" }]), silentLogger());

    await tick(20); // first (startup) fetch is in flight, not yet resolved
    expect(signals[0]?.aborted).toBe(false);

    stdin.write("r"); // second refresh supersedes the first
    await tick();

    expect(signals[0]?.aborted).toBe(true);
    first.resolve([issue("ENG-1")]); // late resolution of the aborted fetch is harmless
    await tick();
    unmount();
  });
});
