// textToHtml turns the plain text typed in the TUI's description editor into the
// minimal HTML Plane stores for descriptions (TipTap output is HTML, and the API
// only persists a description sent via `description_html`). Each line becomes a
// paragraph so line breaks survive the round-trip; HTML metacharacters are
// escaped so the text is preserved literally rather than interpreted as markup.

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (ch) => ESCAPES[ch] ?? ch);
}

// textToHtml wraps each line in a <p>; an empty string yields an empty string so
// clearing a description sends empty HTML rather than a stray empty paragraph.
export function textToHtml(text: string): string {
  if (text.length === 0) return "";
  return text
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}
