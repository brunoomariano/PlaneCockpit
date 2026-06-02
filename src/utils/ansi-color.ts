// Minimal ANSI colorizer for non-Ink output (the CLI table). Ink colors the TUI
// itself; the CLI table is plain text, so we wrap cell text in SGR escapes here.
// Supports the same color forms the theme schema accepts: hex (#rrggbb,
// truecolor), an ANSI-256 index as a string (38;5;N), and named colors.

const RESET = "\x1b[0m";

// SGR foreground codes for the named colors the theme schema allows.
const NAMED_FG: Record<string, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  grey: 90,
  blackBright: 90,
  redBright: 91,
  greenBright: 92,
  yellowBright: 93,
  blueBright: 94,
  magentaBright: 95,
  cyanBright: 96,
  whiteBright: 97,
};

// foregroundSequence turns a theme color into the SGR escape that sets it as the
// foreground, or null when the color is not recognised (caller leaves text bare).
function foregroundSequence(color: string): string | null {
  const hex = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(color);
  if (hex) {
    const r = parseInt(hex[1]!, 16);
    const g = parseInt(hex[2]!, 16);
    const b = parseInt(hex[3]!, 16);
    return `\x1b[38;2;${r};${g};${b}m`;
  }
  if (/^\d{1,3}$/.test(color)) {
    const n = Number(color);
    if (n >= 0 && n <= 255) return `\x1b[38;5;${n}m`;
  }
  const named = NAMED_FG[color];
  if (named !== undefined) return `\x1b[${named}m`;
  return null;
}

// colorize wraps `text` in the foreground color, resetting after. Unknown colors
// pass the text through unchanged.
export function colorize(text: string, color: string): string {
  const seq = foregroundSequence(color);
  return seq ? `${seq}${text}${RESET}` : text;
}
