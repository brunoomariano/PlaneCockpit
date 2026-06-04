import React from "react";
import { Box, Text } from "ink";
import type { InkKey } from "../keybindings/key-spec.js";
import { useTheme } from "./theme/context.js";

// SelectOption is one row in the picker: a stable `value` returned to the caller
// and a human `label` shown in the list. `group` lets the caller cluster options
// under headers (used by the state picker: backlog/started/…).
export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

export interface SelectMode {
  // multi=true turns the picker into a toggle list (enter marks/unmarks, ctrl+s
  // confirms the set); multi=false confirms the highlighted value on enter.
  multi: boolean;
  // initial seeds the marked set (multi) so the picker opens reflecting the
  // issue's current assignees.
  initial?: string[];
}

// SelectState is the headless cursor + marked set the reducer threads between
// keystrokes. Kept separate from React so the navigation logic is unit-testable.
export interface SelectState {
  cursor: number;
  marked: Set<string>;
}

// SelectOutcome is what a keystroke may resolve to: a single value, a confirmed
// multi set, or a cancel. Absent (undefined) means the keystroke only moved the
// cursor or toggled a mark and the picker stays open.
type SelectOutcome =
  | { type: "confirm-single"; value: string }
  | { type: "confirm-multi"; values: string[] }
  | { type: "cancel" };

export interface SelectReduction {
  state: SelectState;
  outcome?: SelectOutcome;
}

// initialSelectState seeds the cursor at the top and, in multi mode, the marked
// set from `initial`.
export function initialSelectState(_options: SelectOption[], mode: SelectMode): SelectState {
  return { cursor: 0, marked: new Set(mode.multi ? (mode.initial ?? []) : []) };
}

function moveCursor(state: SelectState, total: number, delta: number): SelectState {
  const cursor = Math.max(0, Math.min(total - 1, state.cursor + delta));
  return { ...state, cursor };
}

function toggleMarked(marked: Set<string>, value: string): Set<string> {
  const next = new Set(marked);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// reduceSelectKey is the picker's headless core: it maps a keystroke onto the
// next cursor/marked state and an optional outcome. enter confirms (single) or
// toggles (multi); ctrl+s confirms a multi set; esc cancels; j/k/arrows move.
// The (state, options, mode, input, key) shape mirrors the dashboard's dispatch
// sites, so the param cap is waived rather than bundling them.
// eslint-disable-next-line max-params
export function reduceSelectKey(
  state: SelectState,
  options: SelectOption[],
  mode: SelectMode,
  input: string,
  key: InkKey,
): SelectReduction {
  if (key.escape) return { state, outcome: { type: "cancel" } };
  if (key.downArrow || input === "j") return { state: moveCursor(state, options.length, 1) };
  if (key.upArrow || input === "k") return { state: moveCursor(state, options.length, -1) };
  if (key.ctrl && input === "s" && mode.multi) {
    const values = options.map((o) => o.value).filter((v) => state.marked.has(v));
    return { state, outcome: { type: "confirm-multi", values } };
  }
  if (key.return) {
    const current = options[state.cursor];
    if (!current) return { state };
    if (!mode.multi) return { state, outcome: { type: "confirm-single", value: current.value } };
    return { state: { ...state, marked: toggleMarked(state.marked, current.value) } };
  }
  return { state };
}

export interface SelectModalProps {
  title: string;
  options: SelectOption[];
  state: SelectState;
  multi: boolean;
}

function hintFor(multi: boolean): string {
  return multi
    ? "j/k: move · enter: toggle · ctrl+s: save · esc: back"
    : "j/k: move · enter: select · esc: back";
}

// SelectModal is the picker's pure view: a bordered list of options with the
// cursor highlighted and, in multi mode, a checkbox per row. All key handling
// lives in reduceSelectKey, driven by the dashboard while the picker is open.
export function SelectModal(props: SelectModalProps): React.ReactElement {
  const theme = useTheme();
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={1}>
      <Text bold>{props.title}</Text>
      <Box marginTop={1} flexDirection="column">
        {props.options.map((option, idx) => {
          const focused = idx === props.state.cursor;
          const marked = props.multi && props.state.marked.has(option.value);
          const prefix = props.multi ? (marked ? "[x] " : "[ ] ") : focused ? "› " : "  ";
          return (
            <Text key={option.value} color={focused ? theme.selection : undefined} wrap="truncate">
              {prefix}
              {option.label}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{hintFor(props.multi)}</Text>
      </Box>
    </Box>
  );
}
