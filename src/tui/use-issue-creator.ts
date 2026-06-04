import { useCallback, useRef, useState } from "react";
import type { IssueLabel, IssuePriority, IssueState, IssueUser } from "../types/issue.js";
import type { InkKey } from "../keybindings/key-spec.js";
import { applyKey, type TextBuffer } from "./text-buffer.js";
import {
  initialSelectState,
  reduceSelectKey,
  type SelectOption,
  type SelectState,
} from "./select-modal.js";
import {
  priorityOptions,
  stateOptions,
  memberOptions,
  labelOptions,
} from "./issue-field-options.js";
import { EDIT_FIELDS, type EditField } from "./use-issue-editor.js";

// CreateDraft is the new issue being composed. It mirrors EditorDraft minus the
// notion of an "original" — every non-default field is a deliberate choice.
export interface CreateDraft {
  name: string;
  description: string;
  state_id: string;
  priority: IssuePriority;
  assignee_ids: string[];
  label_ids: string[];
}

function emptyDraft(): CreateDraft {
  return {
    name: "",
    description: "",
    state_id: "",
    priority: "none",
    assignee_ids: [],
    label_ids: [],
  };
}

// IssueCreatorController is what the dashboard consumes. `step` drives the two
// phases: pick a project, then fill the form. picker/textEdit mirror the editor.
export interface IssueCreatorController {
  active: boolean;
  step: "project" | "form";
  projectIdentifier: string | undefined;
  draft: CreateDraft;
  field: EditField;
  picker:
    | { kind: "project" | EditField; options: SelectOption[]; state: SelectState; multi: boolean }
    | undefined;
  textEdit: { field: "title" | "description"; buffer: TextBuffer } | undefined;
  saving: boolean;
  names: Record<string, string>;
  // open starts the flow. With a single project it skips straight to the form;
  // with several it opens the project picker first.
  open: () => void;
  handleKey: (input: string, key: InkKey) => void;
}

export interface IssueCreatorDeps {
  // The projects the active view resolves to; the user picks one (or it is
  // inferred when there is exactly one).
  projects: string[];
  loadStates: (projectIdentifier: string) => Promise<IssueState[]>;
  loadMembers: () => Promise<IssueUser[]>;
  loadLabels: (projectIdentifier: string) => Promise<IssueLabel[]>;
  // onCreate posts the new issue; it must throw on failure so the modal stays
  // open and the dashboard surfaces the error.
  onCreate: (projectIdentifier: string, draft: CreateDraft) => Promise<void>;
  // onError reports a picker-load failure so it surfaces in the status bar.
  onError: (message: string) => void;
}

// useIssueCreator owns the create modal's state machine. It deliberately does
// not extend useIssueEditor (which is anchored to an existing issue); it shares
// the field set, option builders and key-handling shape, but adds a project
// step and creates instead of patching.
export function useIssueCreator(deps: IssueCreatorDeps): IssueCreatorController {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<"project" | "form">("project");
  const [projectIdentifier, setProjectIdentifier] = useState<string | undefined>();
  const [draft, setDraft] = useState<CreateDraft>(emptyDraft);
  const [field, setField] = useState<EditField>("title");
  const [picker, setPicker] = useState<IssueCreatorController["picker"]>();
  const [textEdit, setTextEdit] = useState<IssueCreatorController["textEdit"]>();
  const [saving, setSaving] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  const depsRef = useRef(deps);
  depsRef.current = deps;

  const rememberNames = useCallback((pairs: Array<[string, string]>) => {
    setNames((prev) => {
      const next = { ...prev };
      for (const [id, name] of pairs) next[id] = name;
      return next;
    });
  }, []);

  const openWith = useCallback(
    (kind: "project" | EditField, options: SelectOption[], multi: boolean, initial: string[]) => {
      rememberNames(options.map((o) => [o.value, o.label]));
      setPicker({ kind, options, multi, state: initialSelectState(options, { multi, initial }) });
    },
    [rememberNames],
  );

  const open = useCallback(() => {
    const projects = depsRef.current.projects;
    if (projects.length === 0) {
      depsRef.current.onError("no project available to create an issue");
      return;
    }
    setDraft(emptyDraft());
    setField("title");
    setTextEdit(undefined);
    setNames({});
    setActive(true);
    // One project: skip the picker straight to the form. Several: open the
    // project picker as the first step.
    if (projects.length === 1) {
      setProjectIdentifier(projects[0]);
      setStep("form");
      setPicker(undefined);
    } else {
      setProjectIdentifier(undefined);
      setStep("project");
      openWith(
        "project",
        projects.map((p) => ({ value: p, label: p })),
        false,
        [],
      );
    }
  }, [openWith]);

  const close = useCallback(() => {
    setActive(false);
    setPicker(undefined);
    setTextEdit(undefined);
  }, []);

  // openField acts on the focused form field, loading per-project pickers against
  // the chosen project. Title/description open the inline text editor.
  const openField = useCallback(async () => {
    const project = projectIdentifier;
    if (!project) return;
    if (field === "title" || field === "description") {
      const text = field === "title" ? draft.name : draft.description;
      setTextEdit({ field, buffer: { text, caret: text.length } });
      return;
    }
    try {
      if (field === "priority") return openWith("priority", priorityOptions(), false, []);
      if (field === "state") {
        return openWith(
          "state",
          stateOptions(await depsRef.current.loadStates(project)),
          false,
          [],
        );
      }
      if (field === "labels") {
        return openWith(
          "labels",
          labelOptions(await depsRef.current.loadLabels(project)),
          true,
          draft.label_ids,
        );
      }
      openWith(
        "assignee",
        memberOptions(await depsRef.current.loadMembers()),
        true,
        draft.assignee_ids,
      );
    } catch (err) {
      depsRef.current.onError((err as Error).message);
    }
  }, [projectIdentifier, field, draft, openWith]);

  const commitTextEdit = useCallback(() => {
    setTextEdit((te) => {
      if (!te) return undefined;
      const value =
        te.field === "title" ? te.buffer.text.replace(/\n/g, " ").trim() : te.buffer.text;
      setDraft((d) => ({ ...d, [te.field === "title" ? "name" : "description"]: value }));
      return undefined;
    });
  }, []);

  const applyPicked = useCallback((kind: "project" | EditField, value: string | string[]) => {
    if (kind === "project" && typeof value === "string") {
      setProjectIdentifier(value);
      setStep("form");
      setPicker(undefined);
      return;
    }
    setDraft((d) => {
      if (kind === "state" && typeof value === "string") return { ...d, state_id: value };
      if (kind === "priority" && typeof value === "string")
        return { ...d, priority: value as IssuePriority };
      if (kind === "assignee" && Array.isArray(value)) return { ...d, assignee_ids: value };
      if (kind === "labels" && Array.isArray(value)) return { ...d, label_ids: value };
      return d;
    });
    setPicker(undefined);
  }, []);

  const runCreate = useCallback(async () => {
    const project = projectIdentifier;
    if (!project) return;
    // Title is required: the create endpoint rejects a blank name, so guard here
    // with a status-bar hint instead of a failed round-trip.
    if (draft.name.trim().length === 0) {
      depsRef.current.onError("title is required to create an issue");
      return;
    }
    setSaving(true);
    try {
      await depsRef.current.onCreate(project, draft);
      close();
    } catch {
      // onCreate reports + rethrows; keep the modal open with the draft intact.
    } finally {
      setSaving(false);
    }
  }, [projectIdentifier, draft, close]);

  const handlePickerKey = useCallback(
    (current: NonNullable<IssueCreatorController["picker"]>, input: string, key: InkKey) => {
      const { state, outcome } = reduceSelectKey(
        current.state,
        current.options,
        { multi: current.multi },
        input,
        key,
      );
      if (!outcome) return setPicker({ ...current, state });
      if (outcome.type === "cancel") return setPicker(undefined);
      if (outcome.type === "confirm-single") return applyPicked(current.kind, outcome.value);
      applyPicked(current.kind, outcome.values);
    },
    [applyPicked],
  );

  const handleTextEditKey = useCallback(
    (current: NonNullable<IssueCreatorController["textEdit"]>, input: string, key: InkKey) => {
      if (key.ctrl && input === "s") return commitTextEdit();
      if (key.escape) return setTextEdit(undefined);
      setTextEdit({ ...current, buffer: applyKey(current.buffer, input, key) });
    },
    [commitTextEdit],
  );

  const handleFormKey = useCallback(
    (input: string, key: InkKey) => {
      if (key.ctrl && input === "s") return void runCreate();
      if (key.escape) return close();
      if (key.downArrow || input === "j")
        return setField(
          (f) => EDIT_FIELDS[Math.min(EDIT_FIELDS.length - 1, EDIT_FIELDS.indexOf(f) + 1)]!,
        );
      if (key.upArrow || input === "k")
        return setField((f) => EDIT_FIELDS[Math.max(0, EDIT_FIELDS.indexOf(f) - 1)]!);
      if (key.return) void openField();
    },
    [runCreate, close, openField],
  );

  const handleKey = useCallback(
    (input: string, key: InkKey) => {
      if (saving) return;
      // The project step is a single picker; reduceSelectKey handles esc (cancel)
      // which closes the whole modal here since there is no form behind it yet.
      if (step === "project") {
        if (key.escape) return close();
        if (picker) handlePickerKey(picker, input, key);
        return;
      }
      if (textEdit) return handleTextEditKey(textEdit, input, key);
      if (picker) return handlePickerKey(picker, input, key);
      handleFormKey(input, key);
    },
    [saving, step, textEdit, picker, close, handleTextEditKey, handlePickerKey, handleFormKey],
  );

  return {
    active,
    step,
    projectIdentifier,
    draft,
    field,
    picker,
    textEdit,
    saving,
    names,
    open,
    handleKey,
  };
}
