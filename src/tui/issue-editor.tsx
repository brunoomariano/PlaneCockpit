import React from "react";
import { Box, Text } from "ink";
import type { Issue } from "../types/issue.js";
import type { EditorDraft } from "./issue-editor-draft.js";
import type { EditField } from "./use-issue-editor.js";
import { useTheme } from "./theme/context.js";

export interface IssueEditorProps {
  issue: Issue;
  draft: EditorDraft;
  field: EditField;
  dirty: boolean;
  saving: boolean;
  confirmingExit: boolean;
  // names resolves an id (state/assignee/label) to its human name, covering both
  // the issue's original values and anything picked from a loaded picker.
  names: Record<string, string>;
}

// fieldRow renders one editable line, highlighting the focused field and marking
// the value with a "›" cursor so the user sees where enter will act.
function fieldRow(opts: {
  label: string;
  value: string;
  focused: boolean;
  selectionColor: string;
}): React.ReactElement {
  const marker = opts.focused ? "› " : "  ";
  return (
    <Text color={opts.focused ? opts.selectionColor : undefined} wrap="truncate">
      {marker}
      {opts.label}: {opts.value}
    </Text>
  );
}

// nameOf resolves an id to its human name via the editor's shared lookup,
// falling back to the id only when nothing has named it yet.
function nameOf(names: Record<string, string>, id: string): string {
  return names[id] ?? id;
}

function assigneeLabel(draft: EditorDraft, names: Record<string, string>): string {
  return draft.assignee_ids.map((id) => nameOf(names, id)).join(", ") || "—";
}

function stateLabel(draft: EditorDraft, names: Record<string, string>): string {
  return nameOf(names, draft.state_id);
}

function labelsLabel(draft: EditorDraft, names: Record<string, string>): string {
  return draft.label_ids.map((id) => nameOf(names, id)).join(", ") || "—";
}

// IssueEditor is the edit modal's pure view: a read-only header (project · key ·
// updated) above the editable rows (state, assignee, priority, labels), plus a
// hint line and the optional discard-changes confirmation. All key handling
// lives in useIssueEditor.
export function IssueEditor(props: IssueEditorProps): React.ReactElement {
  const theme = useTheme();
  const { issue, draft, field, names } = props;
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.accent}
      paddingX={1}
      paddingY={1}
    >
      <Box justifyContent="space-between">
        <Text bold>
          edit {issue.key}
          {props.dirty ? " *" : ""}
        </Text>
        <Text dimColor>{issue.project_identifier}</Text>
      </Box>
      <Text dimColor>updated: {issue.updated_at || "—"}</Text>
      <Box marginTop={1} flexDirection="column">
        {fieldRow({
          label: "state",
          value: stateLabel(draft, names),
          focused: field === "state",
          selectionColor: theme.selection,
        })}
        {fieldRow({
          label: "assignee",
          value: assigneeLabel(draft, names),
          focused: field === "assignee",
          selectionColor: theme.selection,
        })}
        {fieldRow({
          label: "priority",
          value: draft.priority,
          focused: field === "priority",
          selectionColor: theme.selection,
        })}
        {fieldRow({
          label: "labels",
          value: labelsLabel(draft, names),
          focused: field === "labels",
          selectionColor: theme.selection,
        })}
      </Box>
      <Box marginTop={1}>
        {props.confirmingExit ? (
          <Text color={theme.warning}>discard changes? y: discard · n: keep editing</Text>
        ) : (
          <Text dimColor>
            {props.saving ? "saving… " : "j/k: move · enter: change · ctrl+s: save · esc: close"}
          </Text>
        )}
      </Box>
    </Box>
  );
}
