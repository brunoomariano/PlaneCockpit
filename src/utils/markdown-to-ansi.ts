// markdownToAnsi renders Markdown to ANSI-decorated text suitable for embedding
// inside an Ink <Text> node. We implement a small custom renderer instead of
// pulling marked-terminal — its 7.3.0 release still uses the pre-marked-16
// renderer API and crashes on any marked >=15 (`this.o.heading is not a function`).
//
// Scope is whatever shows up in a Plane issue description: headings, lists,
// inline code, fenced code, links, bold, italic, strikethrough, paragraphs,
// blockquotes, hr. Raw HTML inside markdown is best-effort (tags dropped).

import { marked, type RendererObject, type Tokens } from "marked";

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const ITALIC = `${ESC}3m`;
const UNDERLINE = `${ESC}4m`;
const STRIKETHROUGH = `${ESC}9m`;
const CYAN = `${ESC}36m`;
const BLUE = `${ESC}34m`;
const YELLOW = `${ESC}33m`;
const GRAY = `${ESC}90m`;
const INVERSE = `${ESC}7m`;

const wrap = (text: string, code: string): string => `${code}${text}${RESET}`;

let configured = false;

function configure(): void {
  if (configured) return;
  const renderer: RendererObject = {
    heading(token: Tokens.Heading): string {
      const text = this.parser.parseInline(token.tokens);
      const prefix = "#".repeat(token.depth);
      return `\n${wrap(`${prefix} ${text}`, CYAN + BOLD)}\n\n`;
    },
    paragraph(token: Tokens.Paragraph): string {
      return `${this.parser.parseInline(token.tokens)}\n\n`;
    },
    strong(token: Tokens.Strong): string {
      return wrap(this.parser.parseInline(token.tokens), BOLD);
    },
    em(token: Tokens.Em): string {
      return wrap(this.parser.parseInline(token.tokens), ITALIC);
    },
    del(token: Tokens.Del): string {
      return wrap(this.parser.parseInline(token.tokens), STRIKETHROUGH + DIM);
    },
    codespan(token: Tokens.Codespan): string {
      return wrap(` ${token.text} `, YELLOW + INVERSE);
    },
    code(token: Tokens.Code): string {
      const lines = token.text.split("\n").map((line) => `  ${wrap(line, YELLOW)}`);
      const header = token.lang ? `${wrap(`  ${token.lang}`, DIM)}\n` : "";
      return `\n${header}${lines.join("\n")}\n\n`;
    },
    blockquote(token: Tokens.Blockquote): string {
      const inner = this.parser.parse(token.tokens);
      const indented = inner
        .split("\n")
        .map((line) => (line.length > 0 ? `${wrap("│", GRAY)} ${line}` : line))
        .join("\n");
      return `${indented}\n`;
    },
    list(token: Tokens.List): string {
      const items = token.items.map((item, idx) => {
        const body = this.parser.parse(item.tokens).trim();
        const marker = token.ordered ? `${(token.start as number) + idx}.` : "•";
        return `  ${wrap(marker, CYAN)} ${body}`;
      });
      return `${items.join("\n")}\n\n`;
    },
    listitem(item: Tokens.ListItem): string {
      return this.parser.parse(item.tokens);
    },
    link(token: Tokens.Link): string {
      const label = this.parser.parseInline(token.tokens);
      return `${wrap(label, BLUE + UNDERLINE)} ${wrap(`(${token.href})`, DIM)}`;
    },
    hr(_token: Tokens.Hr): string {
      return `\n${wrap("─".repeat(40), GRAY)}\n\n`;
    },
    br(_token: Tokens.Br): string {
      return "\n";
    },
    html(token: Tokens.HTML | Tokens.Tag): string {
      return token.text.replace(/<[^>]+>/g, "");
    },
  };
  marked.use({ renderer });
  configured = true;
}

export function markdownToAnsi(markdown: string): string {
  if (!markdown) return "";
  configure();
  const out = marked.parse(markdown, { async: false }) as string;
  return out.replace(/\n+$/, "");
}
