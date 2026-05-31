import { describe, it, expect, afterEach } from "vitest";
import { writeFile, rm, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveCommentBody } from "./index.js";

describe("resolveCommentBody", () => {
  const tmp: string[] = [];
  afterEach(async () => {
    await Promise.all(tmp.splice(0).map((p) => rm(p, { recursive: true, force: true })));
  });

  it("prefers --message when no body file is given", async () => {
    expect(await resolveCommentBody({ message: "inline note" })).toBe("inline note");
  });

  // --body-file wins over --message and keeps markdown intact.
  it("reads from --body-file over --message", async () => {
    const dir = await mkdtemp(join(tmpdir(), "plc-comment-"));
    tmp.push(dir);
    const path = join(dir, "c.md");
    await writeFile(path, "## from file\n\nbody", "utf8");
    expect(await resolveCommentBody({ bodyFile: path, message: "ignored" })).toBe(
      "## from file\n\nbody",
    );
  });

  // No message, no body file, no TTY: return empty so the command rejects it
  // instead of hanging on a prompt that can never be answered.
  it("returns empty in non-interactive mode with no input", async () => {
    const original = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    try {
      expect(await resolveCommentBody({})).toBe("");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: original, configurable: true });
    }
  });
});
