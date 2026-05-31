import React from "react";
import { Box, Text } from "ink";
import type { TextBuffer } from "./text-buffer.js";

export interface CommentEditorProps {
  // issueKey labels the editor so the user knows what they are commenting on.
  issueKey: string;
  buffer: TextBuffer;
  submitting?: boolean;
}

// renderWithCaret splices a visible caret marker into the text at the caret
// offset so the user can see where typing lands, including on empty lines.
function renderWithCaret(text: string, caret: number): string {
  return `${text.slice(0, caret)}█${text.slice(caret)}`;
}

// CommentEditor is the multiline comment modal. It is a pure view over a
// TextBuffer; all key handling lives in the dashboard (submit/cancel) and
// text-buffer.applyKey (editing). enter=newline, ctrl+s=submit, esc=cancel.
export function CommentEditor(props: CommentEditorProps): React.ReactElement {
  const shown = renderWithCaret(props.buffer.text, props.buffer.caret);
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} width="100%">
      <Text bold>comment on {props.issueKey}</Text>
      <Box marginTop={1}>
        <Text>{shown || " "}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {props.submitting ? "sending… " : "enter: newline · ctrl+s: submit · esc: cancel"}
        </Text>
      </Box>
    </Box>
  );
}
