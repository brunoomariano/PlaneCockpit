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
    users: { me: vi.fn().mockResolvedValue({ id: "me", display_name: "me" }) },
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

describe("dashboard structured filter (e2e)", () => {
  // The `/` filter accepts key:value tokens applied to the loaded rows. The two
  // seeded issues have priority "none" (the e2e factory default).
  it("narrows the list with a prio: token and shows the match count", async () => {
    const { ctx, logger } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("/"); // start the filter
    await tick();
    stdin.write("prio:none"); // both issues match
    await tick();
    expect(lastFrame()).toContain("title ENG-1");
    expect(lastFrame()).toContain("title ENG-2");

    // A non-matching token empties the visible list (reads as "filtered", not "no
    // data"). Clear the current token in place with backspaces (\x7f) and retype,
    // keeping the same filter session open — closing and re-opening the input
    // would race the state flush between writes. The exact "0 of N" count string
    // is unit-tested in formatListPosition (issue-query.test.ts); here we only
    // assert the rows are gone, since the status bar wraps at the test width.
    stdin.write("\x7f".repeat("prio:none".length));
    await tick();
    stdin.write("prio:urgent");
    await tick();
    expect(lastFrame()).not.toContain("title ENG-1");
    expect(lastFrame()).not.toContain("title ENG-2");
    expect(lastFrame()).toContain("no issues to show");
    unmount();
  });

  // Two issues with distinct assignee/label/priority so the richer tokens have
  // something to discriminate. ENG-1 is mine + bug + high; ENG-2 is someone
  // else + chore + low.
  function richHarness(): Harness {
    const h = harness();
    const eng1: Issue = {
      ...issue("ENG-1"),
      priority: "high",
      assignees: [{ id: "me", display_name: "Ana" }],
      labels: [{ id: "l1", name: "bug" }],
    };
    const eng2: Issue = {
      ...issue("ENG-2"),
      priority: "low",
      assignees: [{ id: "u2", display_name: "Bruno" }],
      labels: [{ id: "l2", name: "chore" }],
    };
    (h.ctx.issues.listResilient as ReturnType<typeof vi.fn>).mockResolvedValue({
      issues: [eng1, eng2],
      failedProjects: [],
    });
    return h;
  }

  // ass:me resolves to the current user (id "me" from users.me) and keeps only
  // the issue assigned to them.
  it("filters by ass:me using the current user", async () => {
    const { ctx, logger } = richHarness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("/");
    await tick();
    stdin.write("ass:me");
    await tick();

    expect(lastFrame()).toContain("title ENG-1"); // mine
    expect(lastFrame()).not.toContain("title ENG-2"); // someone else
    unmount();
  });

  // Tokens of different keys AND together: prio:high label:bug matches only the
  // issue that satisfies both.
  it("ANDs tokens of different keys", async () => {
    const { ctx, logger } = richHarness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("/");
    await tick();
    stdin.write("prio:high label:bug");
    await tick();

    expect(lastFrame()).toContain("title ENG-1");
    expect(lastFrame()).toContain("1 of 2");
    unmount();
  });

  // Repeating a key ORs within it: label:bug label:chore keeps both issues.
  it("ORs repeated tokens of the same key", async () => {
    const { ctx, logger } = richHarness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("/");
    await tick();
    stdin.write("label:bug label:chore");
    await tick();

    expect(lastFrame()).toContain("title ENG-1");
    expect(lastFrame()).toContain("title ENG-2");
    unmount();
  });
});
