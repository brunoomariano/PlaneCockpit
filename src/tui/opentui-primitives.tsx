import React, { useContext, useEffect, useMemo } from "react";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { createTextAttributes, type KeyEvent } from "@opentui/core";
import type { BoxProps as OpenTuiBoxProps, TextProps as OpenTuiTextProps } from "@opentui/react";
import type { TuiKey } from "../keybindings/key-spec.js";

type BorderStyle = "single" | "double" | "rounded" | "heavy";

interface BoxProps extends Omit<
  OpenTuiBoxProps,
  "borderStyle" | "border" | "borderColor" | "children"
> {
  borderStyle?: BorderStyle | "round";
  borderColor?: string;
  children?: React.ReactNode;
}

interface TextProps extends Omit<OpenTuiTextProps, "fg" | "bg" | "attributes" | "children"> {
  color?: string;
  backgroundColor?: string;
  dimColor?: boolean;
  bold?: boolean;
  inverse?: boolean;
  wrap?: "truncate" | "wrap" | "end";
  children?: React.ReactNode;
}

export type InputHandler = (input: string, key: TuiKey) => void;

interface RuntimeContextValue {
  exit: () => void;
  registerInput: (handler: InputHandler) => () => void;
  size: { columns: number; rows: number };
}

const RuntimeContext = React.createContext<RuntimeContextValue | null>(null);
const TextNodeContext = React.createContext(false);

export function OpenTuiRuntimeProvider({
  runtime,
  children,
}: {
  runtime: RuntimeContextValue;
  children: React.ReactNode;
}): React.ReactNode {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

function normalizeBorderStyle(style: BorderStyle | "round" | undefined): BorderStyle | undefined {
  if (style === "round") return "rounded";
  return style;
}

export function Box({
  borderStyle,
  borderColor,
  children,
  flexDirection,
  ...props
}: BoxProps): React.ReactNode {
  return (
    <box
      {...props}
      flexDirection={flexDirection ?? "row"}
      border={borderStyle ? true : undefined}
      borderStyle={normalizeBorderStyle(borderStyle)}
      borderColor={borderColor}
    >
      {children}
    </box>
  );
}

export function Text({
  color,
  backgroundColor,
  dimColor,
  bold,
  inverse,
  wrap,
  children,
  ...props
}: TextProps): React.ReactNode {
  const insideText = useContext(TextNodeContext);
  const textProps = {
    fg: color,
    bg: backgroundColor,
    attributes: createTextAttributes({ bold, dim: dimColor, inverse }),
  };
  if (insideText) {
    return (
      <span {...textProps}>
        <TextNodeContext.Provider value={true}>{children}</TextNodeContext.Provider>
      </span>
    );
  }
  return (
    <text
      {...props}
      {...textProps}
      truncate={wrap === "truncate"}
      wrapMode={wrap === "wrap" ? "word" : undefined}
    >
      <TextNodeContext.Provider value={true}>{children}</TextNodeContext.Provider>
    </text>
  );
}

function isPrintable(event: KeyEvent): boolean {
  return event.name.length === 1 && !event.ctrl && !event.meta;
}

function inputFromEvent(event: KeyEvent): string {
  if (event.name === "space") return " ";
  return isPrintable(event) ? event.name : "";
}

function keyFromEvent(event: KeyEvent): TuiKey {
  const name = event.name.toLowerCase();
  return {
    ctrl: event.ctrl,
    shift: event.shift,
    meta: event.meta,
    return: name === "return" || name === "enter",
    escape: name === "escape" || name === "esc",
    tab: name === "tab",
    backspace: name === "backspace",
    delete: name === "delete",
    upArrow: name === "up",
    downArrow: name === "down",
    leftArrow: name === "left",
    rightArrow: name === "right",
    pageUp: name === "pageup" || name === "page-up",
    pageDown: name === "pagedown" || name === "page-down",
  };
}

export function useInput(handler: InputHandler): void {
  const runtime = useContext(RuntimeContext);
  useEffect(() => {
    if (!runtime) return undefined;
    return runtime.registerInput(handler);
  }, [runtime, handler]);
  if (runtime) return;

  useKeyboard((event) => {
    handler(inputFromEvent(event), keyFromEvent(event));
  });
}

export function useApp(): { exit: () => void } {
  const runtime = useContext(RuntimeContext);
  if (runtime) return { exit: runtime.exit };
  const renderer = useRenderer();
  return useMemo(() => ({ exit: () => void renderer.destroy() }), [renderer]);
}

export function useStdout(): { stdout: { columns: number; rows: number } } {
  const runtime = useContext(RuntimeContext);
  if (runtime) return { stdout: runtime.size };
  const { width, height } = useTerminalDimensions();
  return { stdout: { columns: width, rows: height } };
}
