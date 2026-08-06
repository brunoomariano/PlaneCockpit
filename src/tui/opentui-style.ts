import { SyntaxStyle } from "@opentui/core";

let cachedMarkdownStyle: SyntaxStyle | undefined;

export function markdownSyntaxStyle(): SyntaxStyle {
  if (cachedMarkdownStyle) return cachedMarkdownStyle;
  try {
    cachedMarkdownStyle = SyntaxStyle.fromStyles({
      default: { fg: "#ffffff" },
      heading: { fg: "#ffffff", bold: true },
      link: { fg: "#83a598", underline: true },
      code: { fg: "#fabd2f" },
      blockquote: { fg: "#928374", italic: true },
    });
  } catch {
    cachedMarkdownStyle = {} as SyntaxStyle;
  }
  return cachedMarkdownStyle;
}
