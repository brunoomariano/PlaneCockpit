import type { InkKey } from "../keybindings/key-spec.js";

// TextBuffer is the pure model behind the multiline comment editor: the text and
// a caret offset into it. Keeping the editing logic free of Ink/React makes the
// key handling testable in isolation; the component just renders it and forwards
// keystrokes via applyKey.
export interface TextBuffer {
  readonly text: string;
  readonly caret: number;
}

export function emptyBuffer(): TextBuffer {
  return { text: "", caret: 0 };
}

// applyKey returns the next buffer for a keystroke, or the same buffer when the
// key is not an edit (submit/cancel are handled by the component, not here).
// Enter inserts a newline; only printable input and the basic motions/edits are
// supported — this is a comment box, not a full editor.
export function applyKey(buf: TextBuffer, input: string, key: InkKey): TextBuffer {
  if (key.leftArrow) return moveCaret(buf, -1);
  if (key.rightArrow) return moveCaret(buf, +1);
  if (key.backspace || key.delete) return deleteBack(buf);
  if (key.return) return insert(buf, "\n");
  // Ignore control chords (ctrl/meta) and non-character keys; the component maps
  // ctrl+s to submit and escape to cancel before reaching here.
  if (!input || key.ctrl || key.meta) return buf;
  return insert(buf, input);
}

function insert(buf: TextBuffer, chunk: string): TextBuffer {
  const text = buf.text.slice(0, buf.caret) + chunk + buf.text.slice(buf.caret);
  return { text, caret: buf.caret + chunk.length };
}

function deleteBack(buf: TextBuffer): TextBuffer {
  if (buf.caret === 0) return buf;
  const text = buf.text.slice(0, buf.caret - 1) + buf.text.slice(buf.caret);
  return { text, caret: buf.caret - 1 };
}

function moveCaret(buf: TextBuffer, delta: number): TextBuffer {
  const caret = Math.max(0, Math.min(buf.text.length, buf.caret + delta));
  return { text: buf.text, caret };
}

// isBlank reports whether the buffer holds only whitespace, so the editor can
// reject empty submissions the same way the CLI does.
export function isBlank(buf: TextBuffer): boolean {
  return buf.text.trim().length === 0;
}
