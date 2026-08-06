import React from "react";
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestRendererJSON,
} from "react-test-renderer";
import { OpenTuiRuntimeProvider, type InputHandler } from "./opentui-primitives.js";
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

function keypressFromChar(char: string): [string, TuiKey] {
  if (char === "\r") return ["", { return: true }];
  if (char === "\x1b") return ["", { escape: true }];
  if (char === "\x7f") return ["", { backspace: true }];
  if (char === "\x13") return ["s", { ctrl: true }];
  if (char === " ") return [" ", {}];
  return [char, { shift: char >= "A" && char <= "Z" }];
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
