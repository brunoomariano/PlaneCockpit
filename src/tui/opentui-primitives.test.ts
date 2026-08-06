import { describe, expect, it } from "vitest";
import React, { type ReactElement } from "react";
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestRendererJSON,
} from "react-test-renderer";
import { Box, Text } from "./opentui-primitives.js";

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
