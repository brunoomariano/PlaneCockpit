// Loads keybindings from ~/.config/plane-cli/keybindings.yaml, merging on top of
// the registry's defaults. Missing file => defaults only. Unknown action ids cause
// a startup error rather than silent ignore — typos are easier to debug that way.

import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { z } from "zod";
import { ConfigError } from "../utils/errors.js";
import { expandHome } from "../utils/paths.js";
import { ACTIONS, isActionId, type ActionDescriptor, type ActionId } from "./registry.js";
import { parseKeySpec, type KeySpec } from "./key-spec.js";

const DEFAULT_KEYBINDINGS_PATH = "~/.config/plane-cli/keybindings.yaml";

const overridesSchema = z.record(z.string(), z.string());

export interface ResolvedBinding {
  action: ActionDescriptor;
  spec: KeySpec;
  override: boolean;
}

export interface LoadKeybindingsOptions {
  path?: string;
}

export interface LoadedKeybindings {
  bindings: ResolvedBinding[];
  sourcePath?: string;
}

export async function loadKeybindings(
  opts: LoadKeybindingsOptions = {},
): Promise<LoadedKeybindings> {
  const path = expandHome(opts.path ?? DEFAULT_KEYBINDINGS_PATH);
  let overrides: Record<string, string> = {};
  let sourcePath: string | undefined;
  try {
    const raw = await readFile(path, "utf8");
    let parsed: unknown;
    try {
      parsed = YAML.parse(raw);
    } catch (err) {
      throw new ConfigError(`invalid yaml in ${path}: ${(err as Error).message}`);
    }
    const result = overridesSchema.safeParse(parsed ?? {});
    if (!result.success) {
      throw new ConfigError("keybindings must be a map of action -> key", {
        issues: result.error.issues,
      });
    }
    overrides = result.data;
    sourcePath = path;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  for (const id of Object.keys(overrides)) {
    if (!isActionId(id)) {
      throw new ConfigError(`unknown keybinding action: ${id}`, {
        available: ACTIONS.map((a) => a.id),
      });
    }
  }

  return { bindings: resolveBindings(overrides), sourcePath };
}

export function resolveBindings(overrides: Record<string, string>): ResolvedBinding[] {
  return ACTIONS.map((action) => {
    const rawKey = overrides[action.id] ?? action.defaultKey;
    const spec = parseKeySpec(rawKey);
    return { action, spec, override: rawKey !== action.defaultKey };
  });
}

export function bindingFor(bindings: ResolvedBinding[], id: ActionId): ResolvedBinding {
  const found = bindings.find((b) => b.action.id === id);
  if (!found) throw new Error(`action not bound: ${id}`);
  return found;
}
