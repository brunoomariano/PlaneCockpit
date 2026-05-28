import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadKeybindings, bindingFor, resolveBindings } from "./load.js";
import { ConfigError } from "../utils/errors.js";

function newPath(): string {
  return join(mkdtempSync(join(tmpdir(), "plane-cli-keys-")), "keybindings.yaml");
}

describe("resolveBindings", () => {
  it("returns defaults when no overrides are given", () => {
    const resolved = resolveBindings({});
    expect(resolved.every((r) => !r.override)).toBe(true);
    expect(bindingFor(resolved, "list.next").spec.key).toBe("j");
  });

  it("applies overrides and flags them", () => {
    const resolved = resolveBindings({ "list.next": "down" });
    const next = bindingFor(resolved, "list.next");
    expect(next.spec.key).toBe("down");
    expect(next.override).toBe(true);
    const refresh = bindingFor(resolved, "global.refresh");
    expect(refresh.override).toBe(false);
  });
});

describe("loadKeybindings", () => {
  let path: string;
  beforeEach(() => {
    path = newPath();
  });

  it("returns defaults when the file is missing", async () => {
    const { bindings, sourcePath } = await loadKeybindings({ path });
    expect(sourcePath).toBeUndefined();
    expect(bindingFor(bindings, "list.next").spec.key).toBe("j");
  });

  it("loads overrides from a YAML file", async () => {
    writeFileSync(path, "list.next: down\nlist.prev: up\n");
    const { bindings, sourcePath } = await loadKeybindings({ path });
    expect(sourcePath).toBe(path);
    expect(bindingFor(bindings, "list.next").spec.key).toBe("down");
  });

  it("rejects unknown action ids", async () => {
    writeFileSync(path, "list.does-not-exist: x\n");
    await expect(loadKeybindings({ path })).rejects.toBeInstanceOf(ConfigError);
  });

  it("rejects non-string values", async () => {
    writeFileSync(path, "list.next: 42\n");
    await expect(loadKeybindings({ path })).rejects.toBeInstanceOf(ConfigError);
  });

  it("rejects malformed YAML", async () => {
    writeFileSync(path, ":\n:\n");
    await expect(loadKeybindings({ path })).rejects.toBeInstanceOf(ConfigError);
  });

  it("accepts an empty file", async () => {
    writeFileSync(path, "\n");
    const { bindings } = await loadKeybindings({ path });
    expect(bindingFor(bindings, "list.next").spec.key).toBe("j");
  });
});
