import { describe, it, expect, afterEach } from "vitest";
import { writeFile, rm, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { readAllStdin, readBodyFile } from "./input-source.js";

// withStdin swaps process.stdin for a readable built from `chunks` for the
// duration of `fn`, so the stdin-reading paths can be exercised deterministically.
async function withStdin<T>(chunks: string[], fn: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(process, "stdin");
  const fake = Readable.from(chunks.map((c) => Buffer.from(c, "utf8")));
  Object.defineProperty(process, "stdin", { value: fake, configurable: true });
  try {
    return await fn();
  } finally {
    if (original) Object.defineProperty(process, "stdin", original);
  }
}

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});

async function tempFile(contents: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "plc-body-"));
  created.push(dir);
  const path = join(dir, "body.md");
  await writeFile(path, contents, "utf8");
  return path;
}

describe("readBodyFile", () => {
  // The body is read verbatim from the path (and trimmed of surrounding blanks),
  // preserving internal newlines and markdown so code fences survive.
  it("reads and trims the file contents, keeping internal newlines", async () => {
    const path = await tempFile("\n# Title\n\nbody line\n\n");
    expect(await readBodyFile(path)).toBe("# Title\n\nbody line");
  });

  // A missing file fails with operational context (the failing path), not a bare
  // ENOENT, so the caller can see what was wrong.
  it("wraps fs errors with the path", async () => {
    await expect(readBodyFile("/no/such/body.md")).rejects.toThrow(
      /readBodyFile: read \/no\/such\/body\.md:/,
    );
  });

  it("reads from stdin when the path is '-'", async () => {
    const body = await withStdin(["from ", "stdin\n"], () => readBodyFile("-"));
    expect(body).toBe("from stdin");
  });
});

describe("readAllStdin", () => {
  it("concatenates and trims all stdin chunks", async () => {
    const out = await withStdin(["  a", "b", "c  \n"], () => readAllStdin());
    expect(out).toBe("abc");
  });

  it("returns empty string for empty stdin", async () => {
    expect(await withStdin([], () => readAllStdin())).toBe("");
  });
});
