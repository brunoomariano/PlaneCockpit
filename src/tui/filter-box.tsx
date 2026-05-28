import React from "react";
import { Box, Text } from "ink";

export interface FilterBoxProps {
  active: boolean;
  value: string;
}

export function FilterBox(props: FilterBoxProps): React.ReactElement | null {
  if (!props.active) return null;
  return (
    <Box borderStyle="round" paddingX={1}>
      <Text>filter: </Text>
      <Text color="cyan">{props.value}</Text>
      <Text>_</Text>
    </Box>
  );
}
