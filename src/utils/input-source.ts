import { readFile } from "node:fs/promises";

// readAllStdin drains process.stdin to a trimmed UTF-8 string. Used by commands
// that accept piped input (e.g. `auth login --with-token`, `issue create
// --body-file -`) so an agent can feed data without an interactive prompt.
export async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
}

// readBodyFile reads a body (issue description, comment, …) from a path, or from
// stdin when the path is "-". This mirrors `gh --body-file` and lets agent/MCP
// callers pass a file path instead of inlining large markdown as a shell
// argument, which would mangle newlines and code fences. fs errors are wrapped
// with operational context so the failing path is visible.
export async function readBodyFile(path: string): Promise<string> {
  if (path === "-") return readAllStdin();
  try {
    return (await readFile(path, "utf8")).trim();
  } catch (cause) {
    throw new Error(`readBodyFile: read ${path}: ${(cause as Error).message}`, { cause });
  }
}
