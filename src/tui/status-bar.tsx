import React from "react";
import { Box, Text } from "ink";
import { PRODUCT_NAME, VERSION, AUTHOR_HANDLE } from "../meta.js";

export interface StatusBarProps {
  profile: string;
  workspace: string;
  view: string;
  loading: boolean;
  cacheHit?: boolean;
  message?: string;
  position?: string;
}

export function StatusBar(props: StatusBarProps): React.ReactElement {
  return (
    <Box justifyContent="space-between" borderStyle="round" paddingX={1}>
      <Text>
        <Text bold>{props.profile}</Text>
        {" · "}
        <Text dimColor>{props.workspace}</Text>
        {" · view: "}
        <Text color="cyan">{props.view}</Text>
        {props.position ? (
          <>
            {" · "}
            <Text dimColor>{props.position}</Text>
          </>
        ) : null}
      </Text>
      <Text dimColor>
        <Text bold>{PRODUCT_NAME}</Text>
        {` v${VERSION} · by ${AUTHOR_HANDLE}`}
      </Text>
      <Text>
        {props.loading ? <Text color="yellow">loading… </Text> : null}
        {props.cacheHit ? <Text color="green">cache </Text> : null}
        {props.message ? <Text color="red">{props.message} </Text> : null}
        <Text dimColor>j/k · g/G · PgUp/PgDn · enter · o · r · / · q</Text>
      </Text>
    </Box>
  );
}
