import { homedir } from "node:os";
import { resolve } from "node:path";

// Expands a leading `~` to the user's home directory. Used for config, hosts,
// and keybinding paths so a single, security-relevant expansion is shared.
export function expandHome(p: string): string {
  if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}
