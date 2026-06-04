/**
 * Block 4 — Dashboard edit flow (e2e).
 *
 * Exercises the whole edit action through the rendered Dashboard: `e` opens the
 * editor over the selected issue; arrows move focus; enter opens a field picker;
 * a single ctrl+s save sends one issues.update() PATCH; and escaping a dirty
 * draft asks for confirmation before discarding. Mirrors the comment e2e setup.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Dashboard } from "../tui/dashboard.js";
import type { AppContext } from "../app.js";
import type { Issue, IssueState, IssueUser } from "../types/issue.js";
import { resolveBindings } from "../keybindings/load.js";
import type { FileLogger } from "../utils/file-logger.js";
import { ThemeProvider } from "../tui/theme/context.js";
import { PRESETS } from "../tui/theme/presets.js";

function renderDashboard(ctx: AppContext, logger: FileLogger): ReturnType<typeof render> {
  const dashboard = React.createElement(Dashboard, { ctx, logger });
  return render(
    React.createElement(ThemeProvider, { theme: PRESETS.default, children: dashboard }),
  );
}

// A delay lets Ink flush effects (and the async state/member loads the picker
// needs) between keystrokes so assertions see the settled frame.
const tick = (ms = 120): Promise<void> => new Promise((r) => setTimeout(r, ms));

const STATES: IssueState[] = [
  { id: "s-todo", name: "Todo", group: "unstarted" },
  { id: "s-doing", name: "In Progress", group: "started" },
  { id: "s-done", name: "Done", group: "completed" },
];

const MEMBERS: IssueUser[] = [
  { id: "u-1", display_name: "Ana" },
  { id: "u-2", display_name: "Bruno" },
];

const LABELS = [
  { id: "l-1", name: "bug" },
  { id: "l-2", name: "chore" },
];

function issue(key: string): Issue {
  return {
    id: `id-${key}`,
    sequence_id: 1,
    project_id: "p1",
    project_identifier: "ENG",
    key,
    name: `title ${key}`,
    state: { id: "s-todo", name: "Todo", group: "unstarted" },
    priority: "medium",
    assignees: [],
    labels: [],
    created_at: "",
    updated_at: "2024-01-02T00:00:00Z",
  };
}

interface Harness {
  ctx: AppContext;
  logger: FileLogger;
  update: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

function harness(updateImpl?: () => Promise<Issue>): Harness {
  const update = updateImpl ? vi.fn(updateImpl) : vi.fn().mockResolvedValue(issue("ENG-1"));
  const create = vi.fn().mockResolvedValue(issue("ENG-9"));
  const issues = {
    list: vi.fn().mockResolvedValue([issue("ENG-1"), issue("ENG-2")]),
    listResilient: vi
      .fn()
      .mockResolvedValue({ issues: [issue("ENG-1"), issue("ENG-2")], failedProjects: [] }),
    update,
    create,
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
        defaults: { projects: ["ENG"], auto_refresh_seconds: 0 },
        views: [{ name: "All" }],
      },
    },
    issues,
    workItems: { retrieve: vi.fn().mockResolvedValue(issue("ENG-1")) },
    projects: {
      findByIdentifier: vi.fn(async (identifier: string) => ({
        id: `id-${identifier}`,
        identifier,
        name: identifier,
        workspace_id: "ws",
      })),
    },
    users: {
      list: vi.fn().mockResolvedValue(MEMBERS),
      me: vi.fn().mockResolvedValue({ id: "u-1", display_name: "Ana" }),
    },
    states: { list: vi.fn().mockResolvedValue(STATES) },
    labels: { list: vi.fn().mockResolvedValue(LABELS) },
    keybindings: resolveBindings({}),
    theme: PRESETS.default,
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppContext;
  return { ctx, logger, update, create };
}

describe("dashboard edit flow (e2e)", () => {
  // Scenario 15 + 12: `e` opens the editor; picking a new state and saving with
  // ctrl+s sends one update() PATCH carrying only the changed field.
  it("opens with e, changes the state, and saves one PATCH on ctrl+s", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick(); // initial view load

    stdin.write("e"); // open editor on ENG-1
    await tick();
    expect(lastFrame()).toContain("edit ENG-1");

    stdin.write("j"); // title -> description
    await tick();
    stdin.write("j"); // description -> state
    await tick();
    stdin.write("\r"); // enter opens the state picker
    await tick();
    expect(lastFrame()).toContain("set state");

    stdin.write("j"); // move to "In Progress"
    await tick();
    stdin.write("\r"); // confirm the highlighted state
    await tick();
    // The form shows the picked state's name, not its raw id (regression: a
    // freshly-picked value used to render as its UUID until the next reload).
    expect(lastFrame()).toContain("state: In Progress");
    expect(lastFrame()).not.toContain("state: s-doing");

    stdin.write("\x13"); // ctrl+s saves
    await tick();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("ENG-1", { state_id: "s-doing" });
    // Editor closed: the list header is visible again.
    expect(lastFrame()).toContain("TITLE");
    unmount();
  });

  // Regression: opening the assignee picker must list the workspace members and
  // saving sends the toggled set as assignee_ids (the picker used to crash when a
  // member row arrived without the `{ member }` wrapper — see UsersService).
  it("opens the assignee picker, toggles a member, and saves assignee_ids", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("e");
    await tick();
    stdin.write("j"); // title -> description
    await tick();
    stdin.write("j"); // description -> state
    await tick();
    stdin.write("j"); // state -> assignee
    await tick();
    stdin.write("\r"); // open the assignee picker
    await tick();
    expect(lastFrame()).toContain("set assignees");
    expect(lastFrame()).toContain("Ana");
    expect(lastFrame()).toContain("Bruno");

    stdin.write("\r"); // toggle the first member (Ana)
    await tick();
    stdin.write("\x13"); // ctrl+s confirms the set, back to the form
    await tick();
    stdin.write("\x13"); // ctrl+s saves the issue
    await tick();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("ENG-1", { assignee_ids: ["u-1"] });
    unmount();
  });

  // Opening the label picker lists the project's labels (multi-select) and
  // saving sends the toggled set as label_ids.
  it("opens the label picker, toggles a label, and saves label_ids", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("e");
    await tick();
    stdin.write("j"); // title -> description
    await tick();
    stdin.write("j"); // description -> state
    await tick();
    stdin.write("j"); // state -> assignee
    await tick();
    stdin.write("j"); // assignee -> priority
    await tick();
    stdin.write("j"); // priority -> labels
    await tick();
    stdin.write("\r"); // open the label picker
    await tick();
    expect(lastFrame()).toContain("set labels");
    expect(lastFrame()).toContain("bug");
    expect(lastFrame()).toContain("chore");

    stdin.write("\r"); // toggle the first label (bug)
    await tick();
    stdin.write("\x13"); // ctrl+s confirms the set, back to the form
    await tick();
    stdin.write("\x13"); // ctrl+s saves the issue
    await tick();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("ENG-1", { label_ids: ["l-1"] });
    unmount();
  });

  // Title edits inline: enter opens a single-line editor (title is the first
  // field), typed text is applied with ctrl+s, and the save sends `name`.
  it("edits the title inline and saves name", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("e"); // title is focused first
    await tick();
    stdin.write("\r"); // open the inline title editor
    await tick();
    expect(lastFrame()).toContain("edit title");

    stdin.write("!"); // append to the title buffer
    await tick();
    stdin.write("\x13"); // ctrl+s applies the text back to the form
    await tick();
    expect(lastFrame()).toContain("title: title ENG-1!");

    stdin.write("\x13"); // ctrl+s saves the issue
    await tick();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("ENG-1", { name: "title ENG-1!" });
    unmount();
  });

  // Description edits inline (the second field): enter opens a multiline editor,
  // typed text is applied with ctrl+s, and the save sends `description` (which
  // the work-items adapter then converts to description_html — the field that
  // was silently dropped before that fix).
  it("edits the description inline and saves description", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("e");
    await tick();
    stdin.write("j"); // title -> description
    await tick();
    stdin.write("\r"); // open the inline description editor
    await tick();
    expect(lastFrame()).toContain("edit description");

    stdin.write("a new body");
    await tick();
    stdin.write("\x13"); // ctrl+s applies the text back to the form
    await tick();

    stdin.write("\x13"); // ctrl+s saves the issue
    await tick();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("ENG-1", { description: "a new body" });
    unmount();
  });

  // Scenario 13: ctrl+s with no changes is a no-op (no API call) and just closes.
  it("does not call update when nothing changed", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("e");
    await tick();
    stdin.write("\x13"); // ctrl+s on a pristine draft
    await tick();

    expect(update).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("TITLE");
    unmount();
  });

  // Scenario 16: esc on a pristine draft closes the editor straight away.
  it("closes immediately on esc when there are no changes", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("e");
    await tick();
    expect(lastFrame()).toContain("edit ENG-1");
    stdin.write("\x1b"); // esc
    await tick();

    expect(update).not.toHaveBeenCalled();
    expect(lastFrame()).not.toContain("edit ENG-1");
    unmount();
  });

  // Scenario 17: esc on a dirty draft asks for confirmation; n keeps editing.
  it("asks for confirmation on esc when the draft is dirty", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("e");
    await tick();
    stdin.write("j"); // title -> description
    await tick();
    stdin.write("j"); // description -> state
    await tick();
    stdin.write("\r"); // open state picker
    await tick();
    stdin.write("j"); // move to a different state
    await tick();
    stdin.write("\r"); // confirm -> draft now dirty
    await tick();

    stdin.write("\x1b"); // esc -> should prompt, not close
    await tick();
    expect(lastFrame()).toContain("discard changes?");

    stdin.write("n"); // keep editing
    await tick();
    expect(lastFrame()).toContain("edit ENG-1");
    expect(update).not.toHaveBeenCalled();
    unmount();
  });

  // Scenario 14: a failing save keeps the editor open and surfaces the error.
  it("keeps the editor open and reports the error when the save fails", async () => {
    const { ctx, logger, update } = harness(() => Promise.reject(new Error("boom")));
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("e");
    await tick();
    stdin.write("j"); // title -> description
    await tick();
    stdin.write("j"); // description -> state
    await tick();
    stdin.write("\r"); // open state picker
    await tick();
    stdin.write("j");
    await tick();
    stdin.write("\r"); // confirm a change
    await tick();
    stdin.write("\x13"); // ctrl+s -> save rejects
    await tick();

    expect(update).toHaveBeenCalledTimes(1);
    // Still in the editor, with the error surfaced in the status bar.
    expect(lastFrame()).toContain("edit ENG-1");
    expect(lastFrame()).toContain("boom");
    unmount();
  });
});

describe("dashboard create flow (e2e)", () => {
  // With a single configured project the create modal skips the project picker
  // and opens the form directly; a title plus ctrl+s creates the issue.
  it("opens with n, fills the title, and creates on ctrl+s", async () => {
    const { ctx, logger, create } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick(); // initial view load

    stdin.write("n"); // open the create modal (single project -> straight to form)
    await tick();
    expect(lastFrame()).toContain("new issue");
    expect(lastFrame()).toContain("ENG"); // inferred project in the header

    stdin.write("\r"); // open the inline title editor (title focused first)
    await tick();
    expect(lastFrame()).toContain("edit title");
    stdin.write("New bug"); // type the title
    await tick();
    stdin.write("\x13"); // ctrl+s applies the title back to the form
    await tick();
    expect(lastFrame()).toContain("title: New bug");

    stdin.write("\x13"); // ctrl+s creates the issue
    await tick();

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith("ENG", expect.objectContaining({ name: "New bug" }));
    unmount();
  });

  // ctrl+s with a blank title does not call create; the modal stays open.
  it("blocks create when the title is blank", async () => {
    const { ctx, logger, create } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write("n");
    await tick();
    stdin.write("\x13"); // ctrl+s on an empty title
    await tick();

    expect(create).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("new issue"); // still open
    unmount();
  });
});

describe("dashboard quick state transition (e2e)", () => {
  // `>` proposes the next workflow state with a named confirmation; `y` applies
  // it in one update (the issue starts in Todo -> In Progress).
  it("advances the state on > and applies on y", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write(">"); // propose the next state
    await tick();
    expect(lastFrame()).toContain("Todo");
    expect(lastFrame()).toContain("In Progress");
    expect(lastFrame()).toContain("apply?");

    stdin.write("y"); // confirm
    await tick();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("ENG-1", { state_id: "s-doing" });
    unmount();
  });

  // Cancelling the confirmation makes no API call.
  it("cancels the transition on n without calling update", async () => {
    const { ctx, logger, update } = harness();
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write(">");
    await tick();
    expect(lastFrame()).toContain("apply?");
    stdin.write("n"); // cancel
    await tick();

    expect(update).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("TITLE"); // back to the list
    unmount();
  });

  // At the last state moving forward is a no-op with a hint (no confirmation).
  it("is a no-op with a hint at the last state", async () => {
    const { ctx, logger, update } = harness();
    // Force the selected issue into the last state (Done).
    (ctx.issues.listResilient as ReturnType<typeof vi.fn>).mockResolvedValue({
      issues: [{ ...issue("ENG-1"), state: { id: "s-done", name: "Done", group: "completed" } }],
      failedProjects: [],
    });
    const { stdin, lastFrame, unmount } = renderDashboard(ctx, logger);
    await tick();

    stdin.write(">");
    await tick();

    expect(update).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("already at the last state");
    unmount();
  });

  // When the active view filters by state, the move can change view membership,
  // so the dashboard reconciles by refreshing (an extra listResilient) instead
  // of patching the row in place.
  it("refreshes the view when it filters by state", async () => {
    const { ctx, logger, update } = harness();
    // A view that filters by state_group: an edited state may move the issue out.
    ctx.runtime.profile.views = [{ name: "Started", filters: { state_group: ["unstarted"] } }];
    const listResilient = ctx.issues.listResilient as ReturnType<typeof vi.fn>;
    const { stdin, unmount } = renderDashboard(ctx, logger);
    await tick(); // initial load (1 call)
    const callsAfterLoad = listResilient.mock.calls.length;

    stdin.write(">"); // propose
    await tick();
    stdin.write("y"); // apply
    await tick();

    expect(update).toHaveBeenCalledWith("ENG-1", { state_id: "s-doing" });
    // The save triggered a refresh rather than an in-place patch.
    expect(listResilient.mock.calls.length).toBeGreaterThan(callsAfterLoad);
    unmount();
  });
});
