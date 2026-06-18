/**
 * Block — useDetailStack: the detail panel's navigation stack.
 *
 * Drives the hook through ink-testing-library (no separate renderHook harness in
 * this repo) by rendering a probe component that calls the actions on mount and
 * reports the current target / canGoBack state. Covers: open seeds a single
 * entry, push navigates and enables back, pop returns one level and closes on the
 * last entry, push de-dupes the same issue on top, close clears, and
 * targetFromIssue.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useDetailStack, targetFromIssue, type DetailTarget } from "./use-detail-stack.js";
import type { Issue } from "../types/issue.js";

function target(id: string): DetailTarget {
  return { id, key: `ENG-${id}`, project_id: "p1", project_identifier: "ENG" };
}

type Stack = ReturnType<typeof useDetailStack>;

// Probe runs a sequence of stack actions once on mount and renders the resulting
// state so the test can assert on the frame.
function Probe({ run }: { run: (s: Stack) => void }): React.ReactElement {
  const stack = useDetailStack();
  const ranRef = React.useRef(false);
  if (!ranRef.current) {
    ranRef.current = true;
    run(stack);
  }
  return React.createElement(
    Text,
    null,
    `current=${stack.current?.id ?? "none"} back=${String(stack.canGoBack)}`,
  );
}

function frameAfter(run: (s: Stack) => void): string {
  const { lastFrame } = render(React.createElement(Probe, { run }));
  return lastFrame() ?? "";
}

describe("useDetailStack", () => {
  it("opens with a single-entry stack and no way back", () => {
    const frame = frameAfter((s) => s.open(target("1")));
    expect(frame).toContain("current=1");
    expect(frame).toContain("back=false");
  });

  it("push navigates to the new target and enables going back", () => {
    const frame = frameAfter((s) => {
      s.open(target("1"));
      s.push(target("2"));
    });
    expect(frame).toContain("current=2");
    expect(frame).toContain("back=true");
  });

  it("pop returns to the previous target", () => {
    const frame = frameAfter((s) => {
      s.open(target("1"));
      s.push(target("2"));
      s.pop();
    });
    expect(frame).toContain("current=1");
    expect(frame).toContain("back=false");
  });

  it("pop on the last entry closes the panel", () => {
    const frame = frameAfter((s) => {
      s.open(target("1"));
      s.pop();
    });
    expect(frame).toContain("current=none");
  });

  it("push does not stack the issue already on top", () => {
    const frame = frameAfter((s) => {
      s.open(target("1"));
      s.push(target("1"));
    });
    expect(frame).toContain("current=1");
    expect(frame).toContain("back=false");
  });

  it("close clears the stack", () => {
    const frame = frameAfter((s) => {
      s.open(target("1"));
      s.push(target("2"));
      s.close();
    });
    expect(frame).toContain("current=none");
  });
});

describe("targetFromIssue", () => {
  it("narrows an issue to the stack's target identity", () => {
    const issue = {
      id: "id-9",
      key: "ENG-9",
      project_id: "p1",
      project_identifier: "ENG",
      name: "x",
    } as Issue;
    expect(targetFromIssue(issue)).toEqual({
      id: "id-9",
      key: "ENG-9",
      project_id: "p1",
      project_identifier: "ENG",
    });
  });
});
