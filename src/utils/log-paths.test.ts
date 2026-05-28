import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveLogPath } from "./log-paths.js";

describe("resolveLogPath", () => {
  it("uses XDG_STATE_HOME when set", () => {
    expect(resolveLogPath({ XDG_STATE_HOME: "/tmp/state" })).toBe("/tmp/state/plane-cli/log.jsonl");
  });

  it("falls back to ~/.local/state when XDG_STATE_HOME is empty", () => {
    expect(resolveLogPath({ XDG_STATE_HOME: "" })).toBe(
      join(homedir(), ".local", "state", "plane-cli", "log.jsonl"),
    );
  });

  it("falls back to ~/.local/state when XDG_STATE_HOME is missing", () => {
    expect(resolveLogPath({})).toBe(join(homedir(), ".local", "state", "plane-cli", "log.jsonl"));
  });
});
