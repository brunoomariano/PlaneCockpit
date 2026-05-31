import { describe, it, expect, afterEach } from "vitest";
import { writeFile, rm, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parsePriority, resolveCreateFields } from "./index.js";

describe("parsePriority", () => {
  it("accepts the known priorities", () => {
    expect(parsePriority("urgent")).toBe("urgent");
    expect(parsePriority("none")).toBe("none");
  });

  // An unknown value fails closed instead of being forwarded to the API.
  it("rejects an unknown priority with the expected set", () => {
    expect(() => parsePriority("blocker")).toThrow(/invalid priority: blocker/);
  });
});

describe("resolveCreateFields (headless)", () => {
  const tmp: string[] = [];
  afterEach(async () => {
    await Promise.all(tmp.splice(0).map((p) => rm(p, { recursive: true, force: true })));
  });

  // With a title present the command never prompts; the body comes from the file
  // and priority is parsed from the flag.
  it("builds fields from flags and --body-file without prompting", async () => {
    const dir = await mkdtemp(join(tmpdir(), "plc-create-"));
    tmp.push(dir);
    const bodyFile = join(dir, "body.md");
    await writeFile(bodyFile, "the description", "utf8");

    const fields = await resolveCreateFields({
      title: "Fix login",
      bodyFile,
      priority: "high",
    });
    expect(fields).toEqual({ name: "Fix login", description: "the description", priority: "high" });
  });

  // Title present but no body/priority: still headless, with optional fields unset.
  it("leaves description and priority unset when only a title is given", async () => {
    const fields = await resolveCreateFields({ title: "Just a title" });
    expect(fields).toEqual({ name: "Just a title", description: undefined, priority: undefined });
  });

  // No title and no TTY must fail fast rather than block on a prompt that can
  // never be answered (agent/CI use).
  it("fails when no title is given in non-interactive mode", async () => {
    const original = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    try {
      await expect(resolveCreateFields({})).rejects.toThrow(/title is required/);
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: original, configurable: true });
    }
  });
});
