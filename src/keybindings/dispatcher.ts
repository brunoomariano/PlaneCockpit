import { matchesKey, type InkKey } from "./key-spec.js";
import type { ActionContext, ActionId } from "./registry.js";
import type { ResolvedBinding } from "./load.js";

export type ActionHandler = () => void;

// dispatch walks the bindings in registration order and fires the first handler whose
// (context allowed, key matches) test passes. It returns true if anything fired —
// useful for "did this consume the keystroke" in modal contexts.
// `input` and `key` are the two halves of a single Ink keystroke; keeping them as
// separate params mirrors Ink's useInput callback, so the param cap is waived.
// eslint-disable-next-line max-params
export function dispatch(
  bindings: ResolvedBinding[],
  allowedContexts: ActionContext[],
  handlers: Partial<Record<ActionId, ActionHandler>>,
  input: string,
  key: InkKey,
): boolean {
  for (const binding of bindings) {
    if (!allowedContexts.includes(binding.action.context)) continue;
    // ActionDescriptor.id is typed `string` (it cannot reference ActionId without
    // a circular type), but every id in ACTIONS is a valid ActionId by construction.
    const handler = handlers[binding.action.id as ActionId];
    if (!handler) continue;
    if (matchesKey(binding.spec, input, key)) {
      handler();
      return true;
    }
  }
  return false;
}
