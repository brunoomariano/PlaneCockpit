import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Dashboard } from "../tui/dashboard.js";
import type { AppContext } from "../app.js";
import type { Issue } from "../types/issue.js";
import type { IssueActivity } from "../types/activity.js";
import { resolveBindings } from "../keybindings/load.js";
import type { FileLogger } from "../utils/file-logger.js";
import { ThemeProvider } from "../tui/theme/context.js";
import { PRESETS } from "../tui/theme/presets.js";

// Renders the Dashboard wrapped in a ThemeProvider, mirroring the dash command.
function renderDashboard(ctx: AppContext, logger: FileLogger): ReturnType<typeof render> {
  const dashboard = React.createElement(Dashboard, { ctx, logger });
  return render(
    React.createElement(ThemeProvider, { theme: PRESETS.default, children: dashboard }),
  );
}

// A delay lets Ink flush effects (the async view load and the per-open detail /
// activity fetches) between keystrokes so assertions see the settled frame.
const tick = (ms = 120): Promise<void> => new Promise((r) => setTimeout(r, ms));

// created_at is well in the past so the "time in state" line is a stable, large
// duration regardless of when the test runs.
function issue(key: string): Issue {
  return {
    id: `id-${key}`,
    sequence_id: 1,
    project_id: "p1",
    project_identifier: "ENG",
    key,
    name: `title ${key}`,
    description: "the body text",
    state: { id: "s", name: "Backlog", group: "backlog" },
    priority: "none",
    assignees: [],
    labels: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  };
}

function stateChange(from: string, to: string, createdAt: string): IssueActivity {
  return {
    id: `${from}-${to}`,
    verb: "updated",
    field: "state",
    oldValue: from,
    newValue: to,
    createdAt,
  };
}

interface Harness {
  ctx: AppContext;
  logger: FileLogger;
  listActivities: ReturnType<typeof vi.fn>;
}

function harness(activities: IssueActivity[]): Harness {
  const listActivities = vi.fn().mockResolvedValue(activities);
  const issues = {
    list: vi.fn().mockResolvedValue([issue("ENG-1"), issue("ENG-2")]),
    listResilient: vi
      .fn()
      .mockResolvedValue({ issues: [issue("ENG-1"), issue("ENG-2")], failedProjects: [] }),
  };
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as FileLogger;
  const ctx = {
    runtime: {
      profile_name: "test",
      no_cache: false,
      profile: {
        server: { base_url: "https://x", workspace_slug: "acme" },
        defaults: { projects: ["ENG"] },
        views: [{ name: "All" }],
      },
    },
    issues,
    workItems: { retrieve: vi.fn().mockResolvedValue(issue("ENG-1")) },
    activities: { list: listActivities },
    users: { me: vi.fn().mockResolvedValue({ id: "me", display_name: "me" }) },
    keybindings: resolveBindings({}),
    theme: PRESETS.default,
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppContext;
  return { ctx, logger, listActivities };
}

describe("dashboard detail activity log (e2e)", () => {
  // Opening the detail shows the description and, once the activity log resolves,
  // the "time in state" suffix on the state line.
  it("shows the time-in-state on the detail meta after the log loads", async () => {
    const { ctx, logger } = harness([stateChange("Inbox", "Backlog", "2026-03-01T00:00:00.000Z")]);
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("\r"); // enter opens the detail panel on ENG-1
    await tick();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("the body text"); // description shown
    expect(frame).toContain("· for "); // time-in-state suffix on the state line
    unmount();
  });

  // `a` swaps the description body for the state-change list; pressing it again
  // returns to the description.
  it("toggles the activity log with 'a'", async () => {
    const { ctx, logger, listActivities } = harness([
      stateChange("Inbox", "Backlog", "2026-03-01T00:00:00.000Z"),
      stateChange("Backlog", "In Progress", "2026-04-01T00:00:00.000Z"),
    ]);
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("\r"); // open detail
    await tick();
    expect(listActivities).toHaveBeenCalled();

    stdin.write("a"); // switch to activity body
    await tick();
    let frame = lastFrame() ?? "";
    expect(frame).toContain("Backlog → In Progress");
    expect(frame).not.toContain("the body text");

    stdin.write("a"); // back to description
    await tick();
    frame = lastFrame() ?? "";
    expect(frame).toContain("the body text");
    unmount();
  });

  // A failing activity fetch must not break the detail: the description still
  // renders, and no time-in-state suffix appears.
  it("degrades silently when the activity fetch fails", async () => {
    const { ctx, logger } = harness([]);
    (ctx.activities.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("\r");
    await tick();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("the body text"); // description still there
    expect(frame).not.toContain("· for "); // no timing suffix
    unmount();
  });
});
