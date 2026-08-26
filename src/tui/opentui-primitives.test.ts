import { describe, expect, it } from "vitest";
import React, { type ReactElement } from "react";
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestRendererJSON,
} from "react-test-renderer";
import { Box, Text, translateKeyEvent } from "./opentui-primitives.js";
import { parseKeypress, type ParsedKey } from "@opentui/core";

function jsonOf(node: ReactElement): ReactTestRendererJSON {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(node);
  });
  return tree!.toJSON() as ReactTestRendererJSON;
}

describe("Text", () => {
  it("renders nested Text as OpenTUI spans", () => {
    const tree = jsonOf(
      React.createElement(
        Text,
        null,
        "outer ",
        React.createElement(Text, { dimColor: true }, "inner"),
      ),
    );

    expect(tree.type).toBe("text");
    expect(tree.children?.[1]).toMatchObject({ type: "span" });
  });
});

describe("Box", () => {
  it("defaults to row layout for Ink-compatible callers", () => {
    const tree = jsonOf(React.createElement(Box, null, React.createElement(Text, null, "cell")));

    expect(tree.type).toBe("box");
    expect(tree.props.flexDirection).toBe("row");
  });
});

// keyEvent builds the parsed-key shape OpenTUI hands to the keyboard callback.
function keyEvent(over: Partial<ParsedKey>): ParsedKey {
  return {
    name: "",
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    sequence: "",
    number: false,
    raw: "",
    eventType: "press",
    source: "raw",
    ...over,
  } as ParsedKey;
}

describe("translateKeyEvent", () => {
  // PLC-1: a ctrl chord used to arrive with input "" because the translation reused
  // a printability predicate to answer the key-identity question, leaving every
  // handler that gates on (key.ctrl && input === "s") permanently dead.
  it("carries the letter of a ctrl chord in input", () => {
    const [input, key] = translateKeyEvent(keyEvent({ name: "s", ctrl: true, sequence: "\x13" }));

    expect(input).toBe("s");
    expect(key.ctrl).toBe(true);
  });

  // The same blanking hit alt/meta chords, which is what killed every configured
  // alt+<letter> binding alongside ctrl+<letter>.
  it("carries the letter of a meta chord in input", () => {
    const [input, key] = translateKeyEvent(keyEvent({ name: "s", meta: true }));

    expect(input).toBe("s");
    expect(key.meta).toBe(true);
  });

  it("carries the letter when ctrl and meta are both set", () => {
    const [input, key] = translateKeyEvent(keyEvent({ name: "s", ctrl: true, meta: true }));

    expect(input).toBe("s");
    expect(key.ctrl).toBe(true);
    expect(key.meta).toBe(true);
  });

  // A chord over a non-character key has no letter to carry, so input stays empty
  // and the chord is recognised through the key flags instead.
  it("keeps input empty for a chord over a named key", () => {
    const [input, key] = translateKeyEvent(keyEvent({ name: "pageup", ctrl: true }));

    expect(input).toBe("");
    expect(key.pageUp).toBe(true);
    expect(key.ctrl).toBe(true);
  });

  it("yields the bare character when no modifier is set", () => {
    expect(translateKeyEvent(keyEvent({ name: "j", sequence: "j" }))[0]).toBe("j");
  });

  // parseKeypress lowercases a shifted letter in `name` and keeps the typed
  // character in `sequence`; typing a capital must insert a capital.
  it("preserves the case of a shifted letter", () => {
    const [input, key] = translateKeyEvent(keyEvent({ name: "r", shift: true, sequence: "R" }));

    expect(input).toBe("R");
    expect(key.shift).toBe(true);
  });

  it("yields a space for the space key", () => {
    expect(translateKeyEvent(keyEvent({ name: "space", sequence: " " }))[0]).toBe(" ");
  });

  it.each([
    ["\r", "return"],
    ["\x1b", "escape"],
    ["\x7f", "backspace"],
  ] as const)("keeps input empty for the %s byte", (byte, flag) => {
    const [input, key] = translateKeyEvent(parseKeypress(byte)!);

    expect(input).toBe("");
    expect(key[flag as "return" | "escape" | "backspace"]).toBe(true);
  });

  // The end-to-end proof that the fix reaches the real byte: 0x13 off the wire
  // must land as the pair the ctrl+s handlers are waiting for.
  it("translates the raw 0x13 byte into ctrl+s", () => {
    const [input, key] = translateKeyEvent(parseKeypress("\x13")!);

    expect(input).toBe("s");
    expect(key.ctrl).toBe(true);
  });
});
