import React from "react";
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestRendererJSON,
} from "react-test-renderer";
import { parseKeypress } from "@opentui/core";
import {
  OpenTuiRuntimeProvider,
  translateKeyEvent,
  type InputHandler,
} from "./opentui-primitives.js";
import type { TuiKey } from "../keybindings/key-spec.js";

interface RenderResult {
  lastFrame: () => string | undefined;
  stdin: { write: (input: string) => void };
  unmount: () => void;
}

function readJson(node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(readJson).join("");
  const props = node.props as {
    content?: string;
    initialValue?: string;
    options?: Array<{ name: string; description?: string }>;
  };
  const ownText = [
    props.content,
    props.initialValue,
    ...(props.options?.map((option) => `${option.name}${option.description ?? ""}`) ?? []),
  ]
    .filter((value): value is string => value !== undefined)
    .join("");
  return ownText + readJson(node.children as ReactTestRendererJSON[] | string | null);
}

// keypressFromChar drives the same byte -> key event -> (input, key) path the real
// terminal drives: OpenTUI's parser turns the byte into a key event and the
// production translation turns that into the pair handlers receive. It holds no
// mapping of its own on purpose -- PLC-1 shipped a dead ctrl+s under a green suite
// precisely because this helper used to hard-code ["s", { ctrl: true }] for 0x13,
// asserting a pair production never produced.
function keypressFromChar(char: string): [string, TuiKey] {
  const parsed = parseKeypress(char);
  if (!parsed) throw new Error(`keypressFromChar: unparsable input byte: ${JSON.stringify(char)}`);
  return translateKeyEvent(parsed);
}

export function render(node: React.ReactNode): RenderResult {
  let tree: ReactTestRenderer;
  const handlers: InputHandler[] = [];
  const runtime = {
    exit: (): void => undefined,
    size: { columns: 120, rows: 40 },
    registerInput(handler: InputHandler): () => void {
      handlers.push(handler);
      return () => {
        const index = handlers.indexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
      };
    },
  };
  act(() => {
    tree = create(React.createElement(OpenTuiRuntimeProvider, { runtime, children: node }));
  });
  const frame = (): string => readJson(tree.toJSON());
  return {
    lastFrame: frame,
    stdin: {
      write(input: string): void {
        for (const char of input) {
          const [value, key] = keypressFromChar(char);
          act(() => {
            handlers.at(-1)?.(value, key);
          });
        }
      },
    },
    unmount(): void {
      act(() => tree.unmount());
    },
  };
}
