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

// An empty relations dict (every type present), the default the relations
// endpoint shape requires.
function noRelations(): Record<string, string[]> {
  return {
    blocking: [],
    blocked_by: [],
    duplicate: [],
    relates_to: [],
    start_after: [],
    start_before: [],
    finish_after: [],
    finish_before: [],
  };
}

interface Harness {
  ctx: AppContext;
  logger: FileLogger;
  listActivities: ReturnType<typeof vi.fn>;
  listRelations: ReturnType<typeof vi.fn>;
  view: ReturnType<typeof vi.fn>;
}

function harness(
  activities: IssueActivity[],
  relations: Record<string, string[]> = noRelations(),
): Harness {
  const listActivities = vi.fn().mockResolvedValue(activities);
  const listRelations = vi.fn().mockResolvedValue(relations);
  // issues.view resolves a related issue by key (used to enrich/open a relation).
  const view = vi.fn(async (key: string) => ({ ...issue(key), id: `id-${key}` }));
  const issues = {
    list: vi.fn().mockResolvedValue([issue("ENG-1"), issue("ENG-2")]),
    listResilient: vi
      .fn()
      .mockResolvedValue({ issues: [issue("ENG-1"), issue("ENG-2")], failedProjects: [] }),
    view,
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
    // retrieve returns the issue whose id was requested. Ids are "id-<KEY>", so
    // navigating into a relation (id "id-ENG-80") yields ENG-80's content, not a
    // fixed issue — which is what lets the nested-navigation test observe it.
    workItems: {
      retrieve: vi.fn(async (_p: unknown, id: string) => {
        const key = id.startsWith("id-") ? id.slice(3) : "ENG-1";
        return { ...issue(key), id };
      }),
    },
    activities: { list: listActivities },
    relations: { list: listRelations },
    users: { me: vi.fn().mockResolvedValue({ id: "me", display_name: "me" }) },
    keybindings: resolveBindings({}),
    theme: PRESETS.default,
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppContext;
  return { ctx, logger, listActivities, listRelations, view };
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

// A relation add event in the log, whose old_identifier is the target UUID the
// relations endpoint reports, so the join attaches the key.
function relationAdd(
  type: string,
  targetId: string,
  key: string,
  createdAt: string,
): IssueActivity {
  return {
    id: `${type}-${targetId}`,
    verb: "updated",
    field: type,
    oldValue: "",
    newValue: key,
    oldIdentifier: targetId,
    createdAt,
  };
}

describe("dashboard detail relations (e2e)", () => {
  // `l` opens the relations body, listing the issue's relations grouped by type
  // with their keys; the target's name resolves via issues.view.
  it("opens the relations section with 'l' and lists relations", async () => {
    const relations = { ...noRelations(), blocked_by: ["uuid-94"] };
    const { ctx, logger, view } = harness(
      [relationAdd("blocked_by", "uuid-94", "ENG-94", "2026-05-01T00:00:00.000Z")],
      relations,
    );
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("\r"); // open detail
    await tick();
    stdin.write("l"); // relations body
    await tick();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("blocked by:");
    expect(frame).toContain("ENG-94");
    expect(view).toHaveBeenCalledWith("ENG-94"); // lazy enrichment fired
    unmount();
  });

  // enter on a focused relation pushes its target: the detail reloads on the
  // related issue, and esc returns to the issue we came from.
  it("navigates into a relation and back with esc", async () => {
    const relations = { ...noRelations(), relates_to: ["uuid-80"] };
    const { ctx, logger } = harness(
      [relationAdd("relates_to", "uuid-80", "ENG-80", "2026-05-01T00:00:00.000Z")],
      relations,
    );
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("\r"); // open detail on ENG-1
    await tick();
    stdin.write("l"); // relations
    await tick();
    stdin.write("\r"); // enter opens the focused relation (ENG-80)
    await tick();
    expect(lastFrame() ?? "").toContain("ENG-80"); // now showing the related issue

    stdin.write("\x1b"); // esc pops back to ENG-1
    await tick();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("ENG-1");
    unmount();
  });

  // esc at the root of the stack closes the detail entirely.
  it("closes the detail when esc is pressed at the root", async () => {
    const { ctx, logger } = harness([]);
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("\r"); // open detail
    await tick();
    stdin.write("\x1b"); // esc closes (root of stack)
    await tick();

    expect(lastFrame() ?? "").toContain("TITLE"); // back to the list
    unmount();
  });
});
