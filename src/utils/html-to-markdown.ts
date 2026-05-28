// Convert HTML descriptions coming from Plane into Markdown so they can be rendered
// in the TUI with marked-terminal. We keep the converter as a thin wrapper so it can
// be swapped or stubbed in tests without dragging Turndown into every test file.

import TurndownService from "turndown";

let cached: TurndownService | undefined;

function getService(): TurndownService {
  if (cached) return cached;
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
  });
  // Plane renders strikethrough as `<s>`; turndown handles it as a custom rule.
  service.addRule("strikethrough", {
    filter: ["del", "s", "strike"],
    replacement: (content) => `~~${content}~~`,
  });
  cached = service;
  return service;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return getService().turndown(html).trim();
}
