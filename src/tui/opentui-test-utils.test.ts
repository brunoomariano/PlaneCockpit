/**
 * The test helper is itself under test because PLC-1 hid behind it: it used to
 * hard-code ["s", { ctrl: true }] for byte 0x13 -- the pair production never
 * produced -- so an end-to-end suite certified a ctrl+s save that had never
 * worked. These tests pin that stdin.write now delivers whatever the production
 * translation delivers, so the same regression cannot pass again.
 */

import { describe, expect, it } from "vitest";
import React from "react";
import { useInput } from "./opentui-primitives.js";
import { render } from "./opentui-test-utils.js";
import type { TuiKey } from "../keybindings/key-spec.js";

// Recorder mounts a component that captures every (input, key) pair delivered.
function recorder(): { node: React.ReactNode; presses: Array<[string, TuiKey]> } {
  const presses: Array<[string, TuiKey]> = [];
  function Probe(): React.ReactNode {
    useInput((input, key) => void presses.push([input, key]));
    return null;
  }
  return { node: React.createElement(Probe), presses };
}

describe("render().stdin", () => {
  // The byte the bug was about: 0x13 off the wire must reach handlers as ctrl+s.
  it("delivers the 0x13 byte as ctrl+s", () => {
    const { node, presses } = recorder();
    const { stdin, unmount } = render(node);

    stdin.write("\x13");

    expect(presses).toHaveLength(1);
    expect(presses[0]![0]).toBe("s");
    expect(presses[0]![1].ctrl).toBe(true);
    unmount();
  });

  it.each([
    ["\r", "return"],
    ["\x1b", "escape"],
    ["\x7f", "backspace"],
  ] as const)("delivers %j as its named key", (byte, flag) => {
    const { node, presses } = recorder();
    const { stdin, unmount } = render(node);

    stdin.write(byte);

    expect(presses[0]![1][flag as "return" | "escape" | "backspace"]).toBe(true);
    unmount();
  });

  it("delivers a space as a space character", () => {
    const { node, presses } = recorder();
    const { stdin, unmount } = render(node);

    stdin.write(" ");

    expect(presses[0]![0]).toBe(" ");
    unmount();
  });

  // Uppercase must survive the round trip: the parser lowercases a shifted letter
  // in `name`, so typing "New bug" would insert "new bug" if the translation
  // read the identity instead of the typed character.
  it("preserves the case of an uppercase letter", () => {
    const { node, presses } = recorder();
    const { stdin, unmount } = render(node);

    stdin.write("A");

    expect(presses[0]![0]).toBe("A");
    expect(presses[0]![1].shift).toBe(true);
    unmount();
  });

  it("delivers one press per character, in order", () => {
    const { node, presses } = recorder();
    const { stdin, unmount } = render(node);

    stdin.write("hi");

    expect(presses.map(([input]) => input)).toEqual(["h", "i"]);
    unmount();
  });
});
