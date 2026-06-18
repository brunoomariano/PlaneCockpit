// Presentation helper for a relation row in the detail's Relations section.
// Kept out of the component so the label assembly is unit-testable.

import type { IssueRelation } from "../types/relation.js";
import { humanizeDuration } from "../utils/format-duration.js";

// formatRelationRow renders one relation as a single line:
//   "ENG-80 · Backlog · Lead Page integration · 2d ago"
// The key is always shown; the target's state and name appear once the lazy
// retrieve resolves; the "· Nd ago" suffix appears when the related_at is known.
// A relation still resolving shows just its key (or a short UUID as a last
// resort when even the key is absent), so the row is never blank.
export function formatRelationRow(relation: IssueRelation, now: number): string {
  const head = relation.targetKey ?? `${relation.targetId.slice(0, 8)}…`;
  const parts: string[] = [head];
  if (relation.target) {
    parts.push(relation.target.state.name);
    if (relation.target.name) parts.push(relation.target.name);
  }
  if (relation.relatedAt) {
    const when = Date.parse(relation.relatedAt);
    if (!Number.isNaN(when)) {
      const elapsed = humanizeDuration(now - when);
      parts.push(elapsed === "just now" ? "just now" : `${elapsed} ago`);
    }
  }
  return parts.join(" · ");
}
