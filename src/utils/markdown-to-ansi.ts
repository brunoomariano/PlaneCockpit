// markdownToAnsi renders Markdown into ANSI-decorated text suitable for embedding
// inside an Ink <Text> node. We tune marked-terminal's defaults so the output
// blends with the rest of the TUI (cyan accents, dim secondary lines).

import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

let configured = false;

function configure(): void {
  if (configured) return;
  marked.use(
    markedTerminal({
      reflowText: true,
      width: 78,
      tab: 2,
      firstHeading: "cyan",
      heading: "cyan",
      code: "yellow",
      blockquote: "gray italic",
      link: "blue underline",
      href: "blueBright underline",
      strong: "bold",
      em: "italic",
      del: "dim strikethrough",
      hr: "gray",
    }),
  );
  configured = true;
}

export function markdownToAnsi(markdown: string): string {
  if (!markdown) return "";
  configure();
  const out = marked.parse(markdown, { async: false }) as string;
  // marked-terminal sometimes leaves a trailing newline; trim for tidier rendering.
  return out.replace(/\n+$/, "");
}
