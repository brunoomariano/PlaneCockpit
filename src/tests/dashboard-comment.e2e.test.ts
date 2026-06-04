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

// A delay lets Ink flush effects between keystrokes so assertions see the settled
// frame. The first call must outlast the async view load (which populates the
// selection the comment editor needs), so it is generous.
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

interface Harness {
  ctx: AppContext;
  logger: FileLogger;
  comment: ReturnType<typeof vi.fn>;
}

function harness(): Harness {
  const comment = vi.fn().mockResolvedValue(undefined);
  const issues = {
    list: vi.fn().mockResolvedValue([issue("ENG-1"), issue("ENG-2")]),
    listResilient: vi
      .fn()
      .mockResolvedValue({ issues: [issue("ENG-1"), issue("ENG-2")], failedProjects: [] }),
    comment,
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
    users: {},
    keybindings: resolveBindings({}),
    theme: PRESETS.default,
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppContext;
  return { ctx, logger, comment };
}

describe("dashboard comment flow (e2e)", () => {
  it("opens the editor with c, accepts typed text, and submits on ctrl+s", async () => {
    const { ctx, logger, comment } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick(); // initial view load

    stdin.write("c"); // open comment editor on ENG-1
    await tick();
    expect(lastFrame()).toContain("comment on ENG-1");

    stdin.write("hi"); // type
    await tick();
    expect(lastFrame()).toContain("hi");

    stdin.write(""); // ctrl+s submits
    await tick();

    expect(comment).toHaveBeenCalledWith("ENG-1", "hi");
    // Editor closed: the table header is visible again.
    expect(lastFrame()).toContain("TITLE");
    unmount();
  });

  it("cancels on escape without commenting", async () => {
    const { ctx, logger, comment } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("c");
    await tick();
    stdin.write("draft");
    await tick();
    stdin.write(""); // escape cancels
    await tick();

    expect(comment).not.toHaveBeenCalled();
    expect(lastFrame()).not.toContain("comment on ENG-1");
    unmount();
  });

  it("does not submit a blank comment", async () => {
    const { ctx, logger, comment } = harness();
    const { stdin, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("c");
    await tick();
    stdin.write(""); // ctrl+s on empty buffer
    await tick();

    expect(comment).not.toHaveBeenCalled();
    unmount();
  });
});
