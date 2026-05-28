// KeySpec is the parsed form of a user-facing string like "j", "ctrl+d", "pageDown".
// It is matched against Ink's (input, key) callback shape inside the dashboard.

import { ConfigError } from "../utils/errors.js";

export interface KeySpec {
  key: string;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
  raw: string;
}

const SPECIAL_KEYS = new Set([
  "enter",
  "return",
  "escape",
  "esc",
  "tab",
  "backspace",
  "delete",
  "space",
  "up",
  "down",
  "left",
  "right",
  "pageup",
  "pagedown",
  "home",
  "end",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "f10",
  "f11",
  "f12",
]);

const NORMALIZE: Record<string, string> = {
  return: "enter",
  esc: "escape",
};

export function parseKeySpec(raw: string): KeySpec {
  const value = raw.trim();
  if (value.length === 0) throw new ConfigError("empty key spec");
  // We split on `+` only at the modifier level. The final segment may itself contain a `+`
  // (rare: someone binding to literal `+`), so we tolerate it as the trailing key.
  const parts = value.toLowerCase().split("+");
  let ctrl = false;
  let shift = false;
  let meta = false;
  for (let i = 0; i < parts.length - 1; i++) {
    const mod = parts[i];
    if (mod === "ctrl" || mod === "control") ctrl = true;
    else if (mod === "shift") shift = true;
    else if (mod === "alt" || mod === "meta") meta = true;
    else throw new ConfigError(`unknown modifier in key spec: ${raw}`);
  }
  let key = parts[parts.length - 1] ?? "";
  // Special keys are kept as-is (lowercased); printable ones preserve the original casing
  // from `raw` so "G" still matches shift-g without forcing the user to write "shift+g".
  if (SPECIAL_KEYS.has(key)) {
    key = NORMALIZE[key] ?? key;
  } else if (key.length === 1) {
    const rawKey = value.split("+").pop() ?? "";
    key = rawKey;
    if (rawKey.length === 1 && rawKey >= "A" && rawKey <= "Z") shift = true;
  } else {
    throw new ConfigError(`unknown key in spec: ${raw}`);
  }
  return { key, ctrl, shift, meta, raw };
}

// Ink delivers either a printable character in `input` (with key.shift set) or a flag
// on the `key` object for special keys. matchesKey reconciles both shapes against a KeySpec.
export interface InkKey {
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  pageUp?: boolean;
  pageDown?: boolean;
}

const SPECIAL_KEY_TO_INK: Record<string, keyof InkKey> = {
  enter: "return",
  escape: "escape",
  tab: "tab",
  backspace: "backspace",
  delete: "delete",
  up: "upArrow",
  down: "downArrow",
  left: "leftArrow",
  right: "rightArrow",
  pageup: "pageUp",
  pagedown: "pageDown",
};

export function matchesKey(spec: KeySpec, input: string, key: InkKey): boolean {
  if (Boolean(key.ctrl) !== spec.ctrl) return false;
  if (Boolean(key.meta) !== spec.meta) return false;
  const specialField = SPECIAL_KEY_TO_INK[spec.key.toLowerCase()];
  if (specialField) {
    return Boolean(key[specialField]);
  }
  if (spec.key === "space") return input === " ";
  return input === spec.key;
}
