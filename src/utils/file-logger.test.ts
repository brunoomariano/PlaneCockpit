import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileLogger } from "./file-logger.js";

function newPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "plane-cli-log-"));
  return join(dir, "log.jsonl");
}

function readEntries(path: string): Array<Record<string, unknown>> {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

describe("FileLogger", () => {
  let path: string;
  beforeEach(() => {
    path = newPath();
  });

  it("creates the file with the requested level", () => {
    const logger = new FileLogger({ path });
    expect(existsSync(path)).toBe(true);
    expect(logger.filePath).toBe(path);
  });

  it("appends entries as JSON Lines", () => {
    const logger = new FileLogger({ path });
    logger.info("hello", { user: "ada" });
    logger.warn("careful");
    const entries = readEntries(path);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ level: "info", msg: "hello", user: "ada" });
    expect(entries[1]).toMatchObject({ level: "warn", msg: "careful" });
  });

  it("skips entries below the configured level", () => {
    const logger = new FileLogger({ path, level: "warn" });
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    const entries = readEntries(path);
    expect(entries.map((e) => e.level)).toEqual(["warn", "error"]);
  });

  it("redacts secret-looking fields", () => {
    const logger = new FileLogger({ path });
    logger.info("auth", { api_key: "shh", token: "shh", nested: { password: "shh" } });
    const entry = readEntries(path)[0]!;
    expect(entry.api_key).toBe("***");
    expect(entry.token).toBe("***");
    expect((entry.nested as { password: string }).password).toBe("***");
  });

  it("serializes Error objects with name, message and stack", () => {
    const logger = new FileLogger({ path });
    logger.error("boom", { err: new Error("nope") });
    const entry = readEntries(path)[0]!;
    expect(entry.err).toMatchObject({ name: "Error", message: "nope" });
    expect(typeof (entry.err as { stack: string }).stack).toBe("string");
  });

  it("rotates the file when it exceeds maxBytes", () => {
    const logger = new FileLogger({ path, maxBytes: 64 });
    for (let i = 0; i < 20; i++) logger.info("padding-padding-padding", { i });
    expect(existsSync(`${path}.1`)).toBe(true);
    // After rotation the current file holds the most recent entry only.
    expect(statSync(path).size).toBeGreaterThan(0);
    expect(readEntries(path).length).toBeGreaterThanOrEqual(1);
  });

  it("survives a pre-existing file", () => {
    writeFileSync(path, '{"ts":"x","level":"info","msg":"old"}\n');
    const logger = new FileLogger({ path });
    logger.info("new");
    const entries = readEntries(path);
    expect(entries.map((e) => e.msg)).toEqual(["old", "new"]);
  });
});
