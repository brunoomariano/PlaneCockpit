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

function assigneeLabel(issue: Issue, draft: EditorDraft): string {
  const byId = new Map(issue.assignees.map((a) => [a.id, a.display_name]));
  const names = draft.assignee_ids.map((id) => byId.get(id) ?? id);
  return names.join(", ") || "—";
}

function stateLabel(issue: Issue, draft: EditorDraft): string {
  // The draft holds the state id; show the issue's current name when unchanged,
  // else the raw id (the picker will have shown the human name on selection).
  return draft.state_id === issue.state.id ? issue.state.name : draft.state_id;
}

function labelsLabel(issue: Issue, draft: EditorDraft): string {
  const byId = new Map(issue.labels.map((l) => [l.id, l.name]));
  const names = draft.label_ids.map((id) => byId.get(id) ?? id);
  return names.join(", ") || "—";
}

// IssueEditor is the edit modal's pure view: a read-only header (project · key ·
// updated) above the editable rows (state, assignee, priority, labels), plus a
// hint line and the optional discard-changes confirmation. All key handling
// lives in useIssueEditor.
export function IssueEditor(props: IssueEditorProps): React.ReactElement {
  const theme = useTheme();
  const { issue, draft, field } = props;
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
          value: stateLabel(issue, draft),
          focused: field === "state",
          selectionColor: theme.selection,
        })}
        {fieldRow({
          label: "assignee",
          value: assigneeLabel(issue, draft),
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
          value: labelsLabel(issue, draft),
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
