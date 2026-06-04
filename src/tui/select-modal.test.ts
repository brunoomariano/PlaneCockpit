/**
 * Block 2 — SelectModal key reducer: the pure navigation/selection logic behind
 * the reusable picker.
 *
 * reduceSelectKey is the headless core of the picker: given the current cursor +
 * marked set and an Ink keystroke, it returns the next state plus an optional
 * outcome (confirm with a value/set, or cancel). The React component is a thin
 * view over it. These tests cover single-select confirm, multi-select toggle and
 * confirm, navigation bounds, and cancel.
 */

import { describe, it, expect } from "vitest";
import { reduceSelectKey, initialSelectState, type SelectState } from "./select-modal.js";
import type { InkKey } from "../keybindings/key-spec.js";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

function press(input: string, key: Partial<InkKey> = {}): InkKey {
  return key as InkKey;
}

describe("reduceSelectKey (single-select)", () => {
  // Scenario 4: arrows/j/k move the cursor; enter confirms the highlighted value.
  it("should confirm the highlighted value on enter", () => {
    let state = initialSelectState(OPTIONS, { multi: false });
    const down = reduceSelectKey(state, OPTIONS, { multi: false }, "j", press("j"));
    state = down.state;
    const out = reduceSelectKey(state, OPTIONS, { multi: false }, "", press("", { return: true }));
    expect(out.outcome).toEqual({ type: "confirm-single", value: "b" });
  });

  // Navigation must not run past the ends of the list.
  it("should clamp the cursor at the list bounds", () => {
    let state: SelectState = { cursor: 0, marked: new Set() };
    // up at the top stays at 0
    state = reduceSelectKey(state, OPTIONS, { multi: false }, "k", press("k")).state;
    expect(state.cursor).toBe(0);
    // jump to bottom then down stays at last
    state = reduceSelectKey(
      state,
      OPTIONS,
      { multi: false },
      "",
      press("", { downArrow: true }),
    ).state;
    state = reduceSelectKey(
      state,
      OPTIONS,
      { multi: false },
      "",
      press("", { downArrow: true }),
    ).state;
    state = reduceSelectKey(
      state,
      OPTIONS,
      { multi: false },
      "",
      press("", { downArrow: true }),
    ).state;
    expect(state.cursor).toBe(2);
  });
});

describe("reduceSelectKey (multi-select)", () => {
  // Scenario 5: enter toggles the highlighted option's mark without closing.
  it("should toggle the highlighted option's mark on enter without confirming", () => {
    const state = initialSelectState(OPTIONS, { multi: true });
    const first = reduceSelectKey(state, OPTIONS, { multi: true }, "", press("", { return: true }));
    expect(first.outcome).toBeUndefined();
    expect([...first.state.marked]).toEqual(["a"]);
    // toggling the same option again removes the mark
    const second = reduceSelectKey(
      first.state,
      OPTIONS,
      { multi: true },
      "",
      press("", { return: true }),
    );
    expect([...second.state.marked]).toEqual([]);
  });

  // Scenario 6: ctrl+s confirms the whole marked set (including empty = unassign).
  it("should confirm the entire marked set on ctrl+s", () => {
    let state = initialSelectState(OPTIONS, { multi: true, initial: ["a"] });
    // move to c and mark it
    state = reduceSelectKey(
      state,
      OPTIONS,
      { multi: true },
      "",
      press("", { downArrow: true }),
    ).state;
    state = reduceSelectKey(
      state,
      OPTIONS,
      { multi: true },
      "",
      press("", { downArrow: true }),
    ).state;
    state = reduceSelectKey(state, OPTIONS, { multi: true }, "", press("", { return: true })).state;
    const out = reduceSelectKey(state, OPTIONS, { multi: true }, "s", press("s", { ctrl: true }));
    expect(out.outcome).toEqual({ type: "confirm-multi", values: ["a", "c"] });
  });

  it("should confirm an empty set on ctrl+s when nothing is marked", () => {
    const state = initialSelectState(OPTIONS, { multi: true });
    const out = reduceSelectKey(state, OPTIONS, { multi: true }, "s", press("s", { ctrl: true }));
    expect(out.outcome).toEqual({ type: "confirm-multi", values: [] });
  });
});

describe("reduceSelectKey (cancel)", () => {
  // Scenario 7: esc cancels and proposes no value.
  it("should cancel on escape with no value", () => {
    const state = initialSelectState(OPTIONS, { multi: false });
    const out = reduceSelectKey(state, OPTIONS, { multi: false }, "", press("", { escape: true }));
    expect(out.outcome).toEqual({ type: "cancel" });
  });
});
