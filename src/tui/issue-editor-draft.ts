import type { Issue, IssuePriority } from "../types/issue.js";
import type { UpdateIssueParams } from "../plane/work-items.js";

// EditorDraft is the mutable working copy of an issue's editable fields.
// assignee_ids and label_ids are treated as sets (order-insensitive) for both
// dirty detection and the save patch, matching how Plane stores them.
export interface EditorDraft {
  name: string;
  description: string;
  state_id: string;
  priority: IssuePriority;
  assignee_ids: string[];
  label_ids: string[];
}

// editorOriginal snapshots the issue's current editable fields. The editor opens
// a draft equal to this snapshot, so "dirty" means "diverged from this".
export function editorOriginal(issue: Issue): EditorDraft {
  return {
    name: issue.name,
    description: issue.description ?? "",
    state_id: issue.state.id,
    priority: issue.priority,
    assignee_ids: issue.assignees.map((a) => a.id),
    label_ids: issue.labels.map((l) => l.id),
  };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

// isDraftDirty reports whether the draft diverges from the original in any of the
// three fields. Assignees compare as sets so reordering alone is not a change.
export function isDraftDirty(original: EditorDraft, draft: EditorDraft): boolean {
  if (original.name !== draft.name) return true;
  if (original.description !== draft.description) return true;
  if (original.state_id !== draft.state_id) return true;
  if (original.priority !== draft.priority) return true;
  if (!sameSet(original.assignee_ids, draft.assignee_ids)) return true;
  return !sameSet(original.label_ids, draft.label_ids);
}

// buildUpdatePatch returns only the fields that changed, so the save sends one
// PATCH carrying the minimal diff (an empty object when nothing changed, which
// the dashboard treats as a no-op).
export function buildUpdatePatch(
  original: EditorDraft,
  draft: EditorDraft,
): UpdateIssueParams["patch"] {
  const patch: UpdateIssueParams["patch"] = {};
  if (original.name !== draft.name) patch.name = draft.name;
  if (original.description !== draft.description) patch.description = draft.description;
  if (original.state_id !== draft.state_id) patch.state_id = draft.state_id;
  if (original.priority !== draft.priority) patch.priority = draft.priority;
  if (!sameSet(original.assignee_ids, draft.assignee_ids)) patch.assignee_ids = draft.assignee_ids;
  if (!sameSet(original.label_ids, draft.label_ids)) patch.label_ids = draft.label_ids;
  return patch;
}
