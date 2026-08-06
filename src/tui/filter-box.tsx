import React from "react";
import { Box, Text } from "./opentui-primitives.js";
import { useTheme } from "./theme/context.js";

export interface FilterBoxProps {
  active: boolean;
  value: string;
}

export function FilterBox(props: FilterBoxProps): React.ReactNode {
  const theme = useTheme();
  if (!props.active) return null;
  return (
    <Box borderStyle="round" paddingX={1}>
      <Text>filter: </Text>
      <Text color={theme.accent}>{props.value}</Text>
      <Text>_</Text>
    </Box>
  );
}
