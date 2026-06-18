/**
 * Block — IssueDetail: the timing line and the activity (state-change) body.
 *
 * formatStateChange is unit-tested for the line shape (arrow, missing old value,
 * "ago" suffix). The rendered component is checked for: the "for <duration>"
 * suffix on the state line appearing only when timeInState is set; the activity
 * mode swapping the description body for the state-change list (newest first);
 * and the empty/loading placeholders in activity mode.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { IssueDetail, formatStateChange } from "./issue-detail.js";
import type { Issue } from "../types/issue.js";
import type { IssueActivity } from "../types/activity.js";
import { ThemeProvider } from "./theme/context.js";
import { PRESETS } from "./theme/presets.js";

function issue(): Issue {
  return {
    id: "id-1",
    sequence_id: 1,
    project_id: "p1",
    project_identifier: "ENG",
    key: "ENG-1",
    name: "a title",
    description: "the description body",
    state: { id: "s", name: "Backlog", group: "backlog" },
    priority: "low",
    assignees: [],
    labels: [],
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
  };
}

function change(partial: Partial<IssueActivity>): IssueActivity {
  return {
    id: partial.id ?? "a",
    verb: "updated",
    field: "state",
    oldValue: partial.oldValue,
    newValue: partial.newValue,
    createdAt: partial.createdAt ?? "2026-06-05T00:00:00.000Z",
    actor: partial.actor,
  };
}

function renderDetail(props: React.ComponentProps<typeof IssueDetail>): string {
  const { lastFrame } = render(
    React.createElement(ThemeProvider, {
      theme: PRESETS.default,
      children: React.createElement(IssueDetail, props),
    }),
  );
  return lastFrame() ?? "";
}

describe("formatStateChange", () => {
  const now = Date.parse("2026-06-07T00:00:00.000Z");

  it("renders from → to with an 'ago' suffix", () => {
    const line = formatStateChange(
      change({ oldValue: "Inbox", newValue: "Backlog", createdAt: "2026-06-05T00:00:00.000Z" }),
      now,
    );
    expect(line).toBe("Inbox → Backlog · 2d ago");
  });

  it("drops the left side of the arrow when there is no old value", () => {
    const line = formatStateChange(
      change({ newValue: "Backlog", createdAt: "2026-06-07T00:00:00.000Z" }),
      now,
    );
    expect(line).toBe("→ Backlog · just now");
  });
});

describe("IssueDetail meta timing line", () => {
  // The "for <duration>" suffix shows only once timeInState is known.
  it("appends the time-in-state when provided", () => {
    const frame = renderDetail({ issue: issue(), variant: "modal", timeInState: "3d 4h" });
    expect(frame).toContain("Backlog");
    expect(frame).toContain("for 3d 4h");
  });

  it("omits the suffix while the time-in-state is unknown", () => {
    const frame = renderDetail({ issue: issue(), variant: "modal" });
    expect(frame).not.toContain("for ");
  });
});

describe("IssueDetail activity mode", () => {
  // Activity mode replaces the description with the state-change list, newest
  // first, and labels the header.
  it("renders state changes newest-first", () => {
    const frame = renderDetail({
      issue: issue(),
      variant: "modal",
      mode: "activity",
      viewportRows: 10,
      stateChanges: [
        change({ oldValue: "Inbox", newValue: "Backlog", createdAt: "2026-06-05T00:00:00.000Z" }),
        change({
          oldValue: "Backlog",
          newValue: "In Progress",
          createdAt: "2026-06-06T00:00:00.000Z",
        }),
      ],
    });
    expect(frame).toContain("activity");
    expect(frame).toContain("Backlog → In Progress");
    expect(frame).toContain("Inbox → Backlog");
    // The description must not show through in activity mode.
    expect(frame).not.toContain("the description body");
  });

  it("shows a placeholder when there are no state changes", () => {
    const frame = renderDetail({
      issue: issue(),
      variant: "modal",
      mode: "activity",
      viewportRows: 10,
      stateChanges: [],
    });
    expect(frame).toContain("(no state changes)");
  });

  it("shows a loading placeholder while the log is still loading", () => {
    const frame = renderDetail({
      issue: issue(),
      variant: "modal",
      mode: "activity",
      viewportRows: 10,
      stateChanges: [],
      activityLoading: true,
    });
    expect(frame).toContain("loading activity…");
  });
});

describe("IssueDetail relations mode", () => {
  const relation = (
    type: import("../types/relation.js").RelationType,
    key: string,
  ): import("../types/relation.js").IssueRelation => ({
    type,
    targetId: `id-${key}`,
    targetKey: key,
  });

  // Relations mode replaces the description with the grouped relations list and
  // tags the header.
  it("renders relations grouped by type with their keys", () => {
    const frame = renderDetail({
      issue: issue(),
      variant: "modal",
      mode: "relations",
      viewportRows: 10,
      relations: [relation("blocked_by", "ENG-94"), relation("relates_to", "ENG-80")],
    });
    expect(frame).toContain("relations");
    expect(frame).toContain("blocked by:");
    expect(frame).toContain("ENG-94");
    expect(frame).toContain("relates to:");
    expect(frame).toContain("ENG-80");
    expect(frame).not.toContain("the description body");
  });

  // The focused row carries the selection marker.
  it("marks the focused relation row", () => {
    const frame = renderDetail({
      issue: issue(),
      variant: "modal",
      mode: "relations",
      viewportRows: 10,
      relations: [relation("relates_to", "ENG-80"), relation("relates_to", "ENG-82")],
      relationsSelected: 1,
    });
    expect(frame).toContain("› ENG-82");
  });

  it("shows a placeholder when there are no relations", () => {
    const frame = renderDetail({
      issue: issue(),
      variant: "modal",
      mode: "relations",
      viewportRows: 10,
      relations: [],
    });
    expect(frame).toContain("(no relations)");
  });

  it("shows a loading placeholder while relations load", () => {
    const frame = renderDetail({
      issue: issue(),
      variant: "modal",
      mode: "relations",
      viewportRows: 10,
      relations: [],
      relationsLoading: true,
    });
    expect(frame).toContain("loading relations…");
  });
});
