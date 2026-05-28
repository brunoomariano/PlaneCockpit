import { matchesKey, type InkKey } from "./key-spec.js";
import type { ActionContext, ActionId } from "./registry.js";
import type { ResolvedBinding } from "./load.js";

export type ActionHandler = () => void;

// dispatch walks the bindings in registration order and fires the first handler whose
// (context allowed, key matches) test passes. It returns true if anything fired —
// useful for "did this consume the keystroke" in modal contexts.
export function dispatch(
  bindings: ResolvedBinding[],
  allowedContexts: ActionContext[],
  handlers: Partial<Record<ActionId, ActionHandler>>,
  input: string,
  key: InkKey,
): boolean {
  for (const binding of bindings) {
    if (!allowedContexts.includes(binding.action.context)) continue;
    const handler = handlers[binding.action.id as ActionId];
    if (!handler) continue;
    if (matchesKey(binding.spec, input, key)) {
      handler();
      return true;
    }
  }
  return false;
}
