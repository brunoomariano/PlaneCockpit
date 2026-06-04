import { useCallback, useMemo, useRef, useState } from "react";
import type { Issue, IssuePriority, IssueState, IssueUser } from "../types/issue.js";
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

// The three editable fields, in the order the arrows cycle through them.
export type EditField = "state" | "assignee" | "priority";
export const EDIT_FIELDS: EditField[] = ["state", "assignee", "priority"];

const PRIORITIES: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];

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
  dirty: boolean;
  saving: boolean;
  // confirmingExit is true while the "discard changes?" prompt is showing.
  confirmingExit: boolean;
  open: () => void;
  handleKey: (input: string, key: InkKey) => void;
}

export interface IssueEditorDeps {
  // target is the issue under the cursor; the editor refuses to open without one.
  target: Issue | undefined;
  // states/members feed the state and assignee pickers. They are async because
  // states are fetched per project and members come from the workspace.
  loadStates: (issue: Issue) => Promise<IssueState[]>;
  loadMembers: () => Promise<IssueUser[]>;
  // onSave runs the single PATCH; it must throw on failure so the editor stays
  // open and the dashboard surfaces the error.
  onSave: (issue: Issue, patch: ReturnType<typeof buildUpdatePatch>) => Promise<void>;
  // onError reports a picker-load failure (states/members fetch) so it surfaces
  // in the status bar instead of becoming an unhandled rejection.
  onError: (message: string) => void;
}

function priorityOptions(): SelectOption[] {
  return PRIORITIES.map((p) => ({ value: p, label: p }));
}

function stateOptions(states: IssueState[]): SelectOption[] {
  return states.map((s) => ({ value: s.id, label: s.name, group: s.group }));
}

function memberOptions(members: IssueUser[]): SelectOption[] {
  // Defensive: a member row from a self-hosted Plane may arrive without an id
  // (pending invite). Drop those so the picker never renders a value-less option.
  return members
    .filter((m): m is IssueUser => Boolean(m?.id))
    .map((m) => ({ value: m.id, label: m.display_name ?? m.id }));
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
  const [field, setField] = useState<EditField>("state");
  const [saving, setSaving] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [picker, setPicker] = useState<IssueEditorController["picker"]>();

  const depsRef = useRef(deps);
  depsRef.current = deps;

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
    setField("state");
    setPicker(undefined);
    setConfirmingExit(false);
    setActive(true);
  }, []);

  const close = useCallback(() => {
    setActive(false);
    setPicker(undefined);
    setConfirmingExit(false);
  }, []);

  // openPicker loads the focused field's options (priority is static; state and
  // members are fetched) and opens the matching picker. A fetch failure is routed
  // to onError so it surfaces in the status bar instead of leaking as a rejection.
  const openPicker = useCallback(async () => {
    const target = issue;
    if (!target || !draft) return;
    try {
      if (field === "priority") {
        const opts = priorityOptions();
        setPicker({
          kind: "priority",
          options: opts,
          multi: false,
          state: initialSelectState(opts, { multi: false }),
        });
        return;
      }
      if (field === "state") {
        const opts = stateOptions(await depsRef.current.loadStates(target));
        setPicker({
          kind: "state",
          options: opts,
          multi: false,
          state: initialSelectState(opts, { multi: false }),
        });
        return;
      }
      const opts = memberOptions(await depsRef.current.loadMembers());
      setPicker({
        kind: "assignee",
        options: opts,
        multi: true,
        state: initialSelectState(opts, { multi: true, initial: draft.assignee_ids }),
      });
    } catch (err) {
      depsRef.current.onError(`${target.key}: ${(err as Error).message}`);
    }
  }, [issue, draft, field]);

  const applyPickerOutcome = useCallback((kind: EditField, value: string | string[]) => {
    setDraft((d) => {
      if (!d) return d;
      if (kind === "state" && typeof value === "string") return { ...d, state_id: value };
      if (kind === "priority" && typeof value === "string")
        return { ...d, priority: value as IssuePriority };
      if (kind === "assignee" && Array.isArray(value)) return { ...d, assignee_ids: value };
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
      if (key.return) void openPicker();
    },
    [runSave, dirty, close, openPicker],
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
      if (picker) return handlePickerKey(picker, input, key);
      handleFormKey(input, key);
    },
    [saving, confirmingExit, picker, handleConfirmKey, handlePickerKey, handleFormKey],
  );

  return { active, issue, draft, field, picker, dirty, saving, confirmingExit, open, handleKey };
}
