import { useCallback, useRef, useState } from "react";
import type { Issue } from "../types/issue.js";
import type { InkKey } from "../keybindings/key-spec.js";
import { emptyBuffer, applyKey, isBlank, type TextBuffer } from "./text-buffer.js";

export interface CommentEditorController {
  // active is true while the editor overlay is open.
  active: boolean;
  buffer: TextBuffer;
  submitting: boolean;
  open: () => void;
  // handleKey owns every keystroke while the editor is open: escape cancels,
  // ctrl+s submits, everything else edits the buffer.
  handleKey: (input: string, key: InkKey) => void;
}

export interface CommentEditorDeps {
  // target is the issue the comment applies to (the current selection); the
  // editor refuses to open or submit without one.
  target: Issue | undefined;
  // onSubmit posts the comment; it must throw on failure so the editor can keep
  // the draft open and let the dashboard surface the error.
  onSubmit: (issue: Issue, text: string) => Promise<void>;
}

// useCommentEditor encapsulates the multiline comment editor's state and key
// handling, keeping the Dashboard component small. The network call lives in
// `onSubmit`, supplied by the dashboard. `target`/`onSubmit` are read through a
// ref so the memoised handlers never go stale as the selection changes.
export function useCommentEditor(deps: CommentEditorDeps): CommentEditorController {
  const [active, setActive] = useState(false);
  const [buffer, setBuffer] = useState<TextBuffer>(emptyBuffer());
  const [submitting, setSubmitting] = useState(false);

  const depsRef = useRef(deps);
  depsRef.current = deps;
  const bufferRef = useRef(buffer);
  bufferRef.current = buffer;

  const open = useCallback(() => {
    if (!depsRef.current.target) return;
    setBuffer(emptyBuffer());
    setActive(true);
  }, []);

  const runSubmit = useCallback(async () => {
    const { target, onSubmit } = depsRef.current;
    const draft = bufferRef.current;
    if (!target || isBlank(draft)) return;
    setSubmitting(true);
    try {
      await onSubmit(target, draft.text.trim());
      setActive(false);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleKey = useCallback(
    (input: string, key: InkKey): void => {
      if (submitting) return;
      if (key.escape) return setActive(false);
      if (key.ctrl && input === "s") {
        void runSubmit();
        return;
      }
      setBuffer((buf) => applyKey(buf, input, key));
    },
    [submitting, runSubmit],
  );

  return { active, buffer, submitting, open, handleKey };
}
