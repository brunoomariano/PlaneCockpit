import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { CommentEditor } from "./comment-editor.js";
import { emptyBuffer } from "./text-buffer.js";

const strip = (s: string | undefined): string => (s ?? "").replace(/\[[0-9;]*m/g, "");

describe("CommentEditor", () => {
  it("shows the target issue key and the editing hint", () => {
    const { lastFrame } = render(
      React.createElement(CommentEditor, { issueKey: "ENG-7", buffer: emptyBuffer() }),
    );
    const frame = strip(lastFrame());
    expect(frame).toContain("comment on ENG-7");
    expect(frame).toContain("ctrl+s: submit");
  });

  it("renders the buffer text with a caret marker", () => {
    const { lastFrame } = render(
      React.createElement(CommentEditor, {
        issueKey: "ENG-7",
        buffer: { text: "hello", caret: 5 },
      }),
    );
    expect(strip(lastFrame())).toContain("hello█");
  });

  it("shows a sending state while submitting", () => {
    const { lastFrame } = render(
      React.createElement(CommentEditor, {
        issueKey: "ENG-7",
        buffer: { text: "hi", caret: 2 },
        submitting: true,
      }),
    );
    expect(strip(lastFrame())).toContain("sending");
  });
});
