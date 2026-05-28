import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ResolvedBinding } from "../keybindings/load.js";
import type { ActionContext } from "../keybindings/registry.js";

export interface HelpModalProps {
  bindings: ResolvedBinding[];
  onClose: () => void;
}

const CONTEXT_TITLES: Record<ActionContext, string> = {
  global: "Global",
  list: "Issue list",
  view: "Views",
  filter: "Filter",
  help: "Help modal",
};

interface Group {
  context: ActionContext;
  title: string;
  bindings: ResolvedBinding[];
}

// groupAndFilter is exported so it can be unit-tested without a renderer.
export function groupAndFilter(bindings: ResolvedBinding[], query: string): Group[] {
  const needle = query.trim().toLowerCase();
  const matched = needle
    ? bindings.filter((b) => {
        const haystack = `${b.action.description} ${b.action.id} ${b.spec.raw}`.toLowerCase();
        return haystack.includes(needle);
      })
    : bindings;
  const groups = new Map<ActionContext, ResolvedBinding[]>();
  for (const b of matched) {
    const list = groups.get(b.action.context) ?? [];
    list.push(b);
    groups.set(b.action.context, list);
  }
  return Array.from(groups.entries()).map(([context, list]) => ({
    context,
    title: CONTEXT_TITLES[context],
    bindings: list,
  }));
}

export function HelpModal(props: HelpModalProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupAndFilter(props.bindings, query), [props.bindings, query]);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      props.onClose();
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      return;
    }
    // typing inside the modal goes into the search box
    if (input && !key.ctrl && !key.meta && input !== "?") {
      setQuery((q) => q + input);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      width={80}
    >
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          Keybindings
        </Text>
        <Text dimColor>esc/q to close</Text>
      </Box>
      <Box marginTop={1}>
        <Text>search: </Text>
        <Text color="cyan">{query || " "}</Text>
        <Text dimColor>_</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {groups.length === 0 ? (
          <Text dimColor>no matches</Text>
        ) : (
          groups.map((group) => (
            <Box key={group.context} flexDirection="column" marginTop={1}>
              <Text bold color="yellow">
                {group.title}
              </Text>
              {group.bindings.map((b) => (
                <Box key={b.action.id}>
                  <Text>{padRight(b.spec.raw, 14)}</Text>
                  <Text>{padRight(b.action.id, 24)}</Text>
                  <Text dimColor>{b.action.description}</Text>
                  {b.override ? <Text color="green"> *</Text> : null}
                </Box>
              ))}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

function padRight(value: string, width: number): string {
  if (value.length >= width) return `${value.slice(0, width - 1)} `;
  return value + " ".repeat(width - value.length);
}
