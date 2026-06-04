import React from "react";
import { Box, Text } from "ink";
import type { CreateDraft } from "./use-issue-creator.js";
import type { EditField } from "./use-issue-editor.js";
import type { TextBuffer } from "./text-buffer.js";
import { fieldRow, nameOf, descriptionPreview, TextFieldEditor } from "./issue-editor.js";
import { useTheme } from "./theme/context.js";

export interface IssueCreatorProps {
  projectIdentifier: string | undefined;
  draft: CreateDraft;
  field: EditField;
  saving: boolean;
  names: Record<string, string>;
  textEdit?: { field: "title" | "description"; buffer: TextBuffer };
}

// stateValue shows the chosen state's name (via the lookup) or a hint when the
// new issue has no state yet (the project default will apply on create).
function stateValue(draft: CreateDraft, names: Record<string, string>): string {
  return draft.state_id ? nameOf(names, draft.state_id) : "(project default)";
}

// IssueCreator is the create modal's pure view: the chosen project in the header
// and the same field rows as the edit modal, but for a brand-new draft. Key
// handling lives in useIssueCreator.
export function IssueCreator(props: IssueCreatorProps): React.ReactElement {
  const theme = useTheme();
  const { draft, field, names } = props;
  if (props.textEdit) {
    return (
      <TextFieldEditor
        field={props.textEdit.field}
        buffer={props.textEdit.buffer}
        accent={theme.accent}
      />
    );
  }
  const assignees = draft.assignee_ids.map((id) => nameOf(names, id)).join(", ") || "—";
  const labels = draft.label_ids.map((id) => nameOf(names, id)).join(", ") || "—";
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.accent}
      paddingX={1}
      paddingY={1}
    >
      <Box justifyContent="space-between">
        <Text bold>new issue</Text>
        <Text dimColor>{props.projectIdentifier ?? "—"}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {fieldRow({
          label: "title",
          value: draft.name || "—",
          focused: field === "title",
          selectionColor: theme.selection,
        })}
        {fieldRow({
          label: "description",
          value: descriptionPreview(draft.description),
          focused: field === "description",
          selectionColor: theme.selection,
        })}
        {fieldRow({
          label: "state",
          value: stateValue(draft, names),
          focused: field === "state",
          selectionColor: theme.selection,
        })}
        {fieldRow({
          label: "assignee",
          value: assignees,
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
          value: labels,
          focused: field === "labels",
          selectionColor: theme.selection,
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {props.saving ? "creating… " : "j/k: move · enter: change · ctrl+s: create · esc: cancel"}
        </Text>
      </Box>
    </Box>
  );
}
