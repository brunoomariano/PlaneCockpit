import { useCallback, useMemo, useRef, useState } from "react";
import type { Issue, IssueLabel, IssuePriority, IssueState, IssueUser } from "../types/issue.js";
import type { InkKey } from "../keybindings/key-spec.js";
import {
  editorOriginal,
  isDraftDirty,
  buildUpdatePatch,
  type EditorDraft,
} from "./issue-editor-draft.js";
import {
  initialSelectState,
  reduceSelectKey,
  type SelectOption,
  type SelectState,
} from "./select-modal.js";
import { applyKey, type TextBuffer } from "./text-buffer.js";
import {
  priorityOptions,
  stateOptions,
  memberOptions,
  labelOptions,
} from "./issue-field-options.js";

// The editable fields, in the order the arrows cycle through them. `title` and
// `description` are free-text fields edited inline; the rest open a picker.
export type EditField = "title" | "description" | "state" | "assignee" | "priority" | "labels";
export const EDIT_FIELDS: EditField[] = [
  "title",
  "description",
  "state",
  "assignee",
  "priority",
  "labels",
];

// IssueEditorController is what the dashboard consumes: the draft + UI state, a
// key handler that owns every keystroke while the editor is open, and flags for
// rendering (which field is focused, which picker is open, dirty, saving).
export interface IssueEditorController {
  active: boolean;
  issue: Issue | undefined;
  draft: EditorDraft | undefined;
  field: EditField;
  picker:
    | { kind: EditField; options: SelectOption[]; state: SelectState; multi: boolean }
    | undefined;
  // textEdit is set while a free-text field (title/description) is being edited
  // inline: the field and its working buffer. ctrl+s commits it to the draft,
  // esc discards the in-progress text. title is single-line, description multi.
  textEdit: { field: "title" | "description"; buffer: TextBuffer } | undefined;
  dirty: boolean;
  saving: boolean;
  // confirmingExit is true while the "discard changes?" prompt is showing.
  confirmingExit: boolean;
  // names maps every id seen so far (state/assignee/label) to its human name, so
  // the form can render a freshly-picked value by name instead of its raw id.
  // It is seeded from the issue and grows as each picker loads its options.
  names: Record<string, string>;
  open: () => void;
  handleKey: (input: string, key: InkKey) => void;
}

export interface IssueEditorDeps {
  // target is the issue under the cursor; the editor refuses to open without one.
  target: Issue | undefined;
  // states/members/labels feed the pickers. They are async because states and
  // labels are fetched per project and members come from the workspace.
  loadStates: (issue: Issue) => Promise<IssueState[]>;
  loadMembers: () => Promise<IssueUser[]>;
  loadLabels: (issue: Issue) => Promise<IssueLabel[]>;
  // onSave runs the single PATCH; it must throw on failure so the editor stays
  // open and the dashboard surfaces the error.
  onSave: (issue: Issue, patch: ReturnType<typeof buildUpdatePatch>) => Promise<void>;
  // onError reports a picker-load failure (states/members fetch) so it surfaces
  // in the status bar instead of becoming an unhandled rejection.
  onError: (message: string) => void;
}

// useIssueEditor encapsulates the edit modal's state machine: a draft seeded from
// the issue, focus across the three fields, an inner picker per field, dirty
// tracking, an exit-confirmation gate, and the single-PATCH save. The network
// calls live in deps. Deps are read through a ref so the memoised handlers never
// go stale as the selection changes.
export function useIssueEditor(deps: IssueEditorDeps): IssueEditorController {
  const [active, setActive] = useState(false);
  const [issue, setIssue] = useState<Issue | undefined>();
  const [original, setOriginal] = useState<EditorDraft | undefined>();
  const [draft, setDraft] = useState<EditorDraft | undefined>();
  const [field, setField] = useState<EditField>("title");
  const [saving, setSaving] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [picker, setPicker] = useState<IssueEditorController["picker"]>();
  const [textEdit, setTextEdit] = useState<IssueEditorController["textEdit"]>();
  // id -> human name, seeded from the issue and extended as each picker loads.
  // Lets the form render a freshly-picked value by name instead of its raw id.
  const [names, setNames] = useState<Record<string, string>>({});

  const depsRef = useRef(deps);
  depsRef.current = deps;

  // rememberNames merges resolved id->name pairs (from the issue or a picker's
  // options) into the lookup the form renders from.
  const rememberNames = useCallback((pairs: Array<[string, string]>) => {
    setNames((prev) => {
      const next = { ...prev };
      for (const [id, name] of pairs) next[id] = name;
      return next;
    });
  }, []);

  const dirty = useMemo(
    () => (original && draft ? isDraftDirty(original, draft) : false),
    [original, draft],
  );

  const open = useCallback(() => {
    const target = depsRef.current.target;
    if (!target) return;
    const snapshot = editorOriginal(target);
    setIssue(target);
    setOriginal(snapshot);
    setDraft({ ...snapshot, assignee_ids: [...snapshot.assignee_ids] });
    setField("title");
    setPicker(undefined);
    setTextEdit(undefined);
    setConfirmingExit(false);
    // Seed the name lookup from the issue's own state/assignees/labels.
    setNames({
      [target.state.id]: target.state.name,
      ...Object.fromEntries(target.assignees.map((a) => [a.id, a.display_name])),
      ...Object.fromEntries(target.labels.map((l) => [l.id, l.name])),
    });
    setActive(true);
  }, []);

  const close = useCallback(() => {
    setActive(false);
    setPicker(undefined);
    setTextEdit(undefined);
    setConfirmingExit(false);
  }, []);

  // openWith records the options' id->label pairs (so the form can name a picked
  // value) and opens the picker, seeding its marked set for the multi case.
  const openWith = useCallback(
    (kind: EditField, options: SelectOption[], multi: boolean, initial: string[]) => {
      rememberNames(options.map((o) => [o.value, o.label]));
      setPicker({ kind, options, multi, state: initialSelectState(options, { multi, initial }) });
    },
    [rememberNames],
  );

  // openPicker loads the focused field's options (priority is static; state,
  // members and labels are fetched) and opens the matching picker. A fetch
  // failure is routed to onError so it surfaces in the status bar instead of
  // leaking as a rejection.
  const openPicker = useCallback(async () => {
    const target = issue;
    if (!target || !draft) return;
    try {
      if (field === "priority") return openWith("priority", priorityOptions(), false, []);
      if (field === "state") {
        return openWith("state", stateOptions(await depsRef.current.loadStates(target)), false, []);
      }
      if (field === "labels") {
        const opts = labelOptions(await depsRef.current.loadLabels(target));
        return openWith("labels", opts, true, draft.label_ids);
      }
      const opts = memberOptions(await depsRef.current.loadMembers());
      openWith("assignee", opts, true, draft.assignee_ids);
    } catch (err) {
      depsRef.current.onError(`${target.key}: ${(err as Error).message}`);
    }
  }, [issue, draft, field, openWith]);

  // openField acts on the focused field: a text field (title/description) opens
  // the inline text editor seeded from the draft; everything else opens a picker.
  const openField = useCallback(() => {
    if (!draft) return;
    if (field === "title" || field === "description") {
      const text = field === "title" ? draft.name : draft.description;
      setTextEdit({ field, buffer: { text, caret: text.length } });
      return;
    }
    void openPicker();
  }, [draft, field, openPicker]);

  // commitTextEdit writes the in-progress buffer back to the draft and closes the
  // inline editor (ctrl+s). title is collapsed to a single line.
  const commitTextEdit = useCallback(() => {
    setTextEdit((te) => {
      if (!te) return undefined;
      const value =
        te.field === "title" ? te.buffer.text.replace(/\n/g, " ").trim() : te.buffer.text;
      setDraft((d) => (d ? { ...d, [te.field === "title" ? "name" : "description"]: value } : d));
      return undefined;
    });
  }, []);

  const applyPickerOutcome = useCallback((kind: EditField, value: string | string[]) => {
    setDraft((d) => {
      if (!d) return d;
      if (kind === "state" && typeof value === "string") return { ...d, state_id: value };
      if (kind === "priority" && typeof value === "string")
        return { ...d, priority: value as IssuePriority };
      if (kind === "assignee" && Array.isArray(value)) return { ...d, assignee_ids: value };
      if (kind === "labels" && Array.isArray(value)) return { ...d, label_ids: value };
      return d;
    });
    setPicker(undefined);
  }, []);

  const runSave = useCallback(async () => {
    if (!issue || !original || !draft) return;
    const patch = buildUpdatePatch(original, draft);
    if (Object.keys(patch).length === 0) {
      close();
      return;
    }
    setSaving(true);
    try {
      await depsRef.current.onSave(issue, patch);
      close();
    } catch {
      // onSave reports the failure (status bar + log) and re-throws so we keep
      // the editor open with the draft intact. The message is already surfaced
      // there, so we only need to swallow the rejection here — not silence it.
    } finally {
      setSaving(false);
    }
  }, [issue, original, draft, close]);

  const handlePickerKey = useCallback(
    (current: NonNullable<IssueEditorController["picker"]>, input: string, key: InkKey) => {
      const { state, outcome } = reduceSelectKey(
        current.state,
        current.options,
        { multi: current.multi },
        input,
        key,
      );
      if (!outcome) {
        setPicker({ ...current, state });
        return;
      }
      if (outcome.type === "cancel") return setPicker(undefined);
      if (outcome.type === "confirm-single") return applyPickerOutcome(current.kind, outcome.value);
      applyPickerOutcome(current.kind, outcome.values);
    },
    [applyPickerOutcome],
  );

  const handleFormKey = useCallback(
    (input: string, key: InkKey) => {
      if (key.ctrl && input === "s") return void runSave();
      if (key.escape) {
        if (dirty) return setConfirmingExit(true);
        return close();
      }
      if (key.downArrow || input === "j")
        return setField(
          (f) => EDIT_FIELDS[Math.min(EDIT_FIELDS.length - 1, EDIT_FIELDS.indexOf(f) + 1)]!,
        );
      if (key.upArrow || input === "k")
        return setField((f) => EDIT_FIELDS[Math.max(0, EDIT_FIELDS.indexOf(f) - 1)]!);
      if (key.return) openField();
    },
    [runSave, dirty, close, openField],
  );

  // While the inline text editor is open, every keystroke edits the buffer except
  // ctrl+s (commit to the draft) and esc (discard the in-progress text). This is
  // a separate mode because j/k/enter are literal input here, not navigation.
  const handleTextEditKey = useCallback(
    (current: NonNullable<IssueEditorController["textEdit"]>, input: string, key: InkKey) => {
      if (key.ctrl && input === "s") return commitTextEdit();
      if (key.escape) return setTextEdit(undefined);
      setTextEdit({ ...current, buffer: applyKey(current.buffer, input, key) });
    },
    [commitTextEdit],
  );

  const handleConfirmKey = useCallback(
    (input: string, key: InkKey) => {
      // y/enter discards and closes; n/esc returns to the form with the draft.
      if (input === "y" || key.return) return close();
      if (input === "n" || key.escape) return setConfirmingExit(false);
    },
    [close],
  );

  const handleKey = useCallback(
    (input: string, key: InkKey) => {
      if (saving) return;
      if (confirmingExit) return handleConfirmKey(input, key);
      if (textEdit) return handleTextEditKey(textEdit, input, key);
      if (picker) return handlePickerKey(picker, input, key);
      handleFormKey(input, key);
    },
    [
      saving,
      confirmingExit,
      textEdit,
      picker,
      handleConfirmKey,
      handleTextEditKey,
      handlePickerKey,
      handleFormKey,
    ],
  );

  return {
    active,
    issue,
    draft,
    field,
    picker,
    textEdit,
    dirty,
    saving,
    confirmingExit,
    names,
    open,
    handleKey,
  };
}
