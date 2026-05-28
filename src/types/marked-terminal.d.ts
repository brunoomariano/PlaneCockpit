declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";

  export interface MarkedTerminalOptions {
    reflowText?: boolean;
    width?: number;
    tab?: number;
    firstHeading?: string;
    heading?: string;
    code?: string;
    blockquote?: string;
    link?: string;
    href?: string;
    strong?: string;
    em?: string;
    del?: string;
    hr?: string;
  }

  export function markedTerminal(options?: MarkedTerminalOptions): MarkedExtension;
}
