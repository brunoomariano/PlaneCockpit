import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CredentialsStore, hostKey } from "./credentials.js";
import { ConfigError } from "../utils/errors.js";

function newPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "plane-cli-creds-"));
  return join(dir, "hosts.yaml");
}

describe("hostKey", () => {
  it("normalizes trailing slashes", () => {
    expect(hostKey("https://plane.example.com/", "acme")).toBe(
      hostKey("https://plane.example.com", "acme"),
    );
  });

  it("separates different workspaces", () => {
    expect(hostKey("https://plane.example.com", "a")).not.toBe(
      hostKey("https://plane.example.com", "b"),
    );
  });
});

describe("CredentialsStore", () => {
  let path: string;
  beforeEach(() => {
    path = newPath();
  });

  it("returns undefined when host file is missing", async () => {
    const store = new CredentialsStore({ path });
    expect(await store.get("h", "a")).toBeUndefined();
  });

  it("writes a credential and reads it back", async () => {
    const store = new CredentialsStore({ path });
    await store.set("h", "production", { api_key: "k" });
    expect(await store.get("h", "production")).toEqual({ api_key: "k" });
  });

  it("persists the file at 0600", async () => {
    const store = new CredentialsStore({ path });
    await store.set("h", "p", { api_key: "k" });
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("deletes an entry and reports whether it existed", async () => {
    const store = new CredentialsStore({ path });
    expect(await store.delete("h", "p")).toBe(false);
    await store.set("h", "p", { api_key: "k" });
    expect(await store.delete("h", "p")).toBe(true);
    expect(await store.get("h", "p")).toBeUndefined();
  });

  it("rejects a malformed hosts file", async () => {
    writeFileSync(path, "not-a-valid-hosts-file\n");
    const store = new CredentialsStore({ path });
    await expect(store.get("h", "p")).rejects.toBeInstanceOf(ConfigError);
  });

  it("exposes the resolved file path", () => {
    const store = new CredentialsStore({ path });
    expect(store.filePath).toBe(path);
  });

  it("caches the file between calls", async () => {
    const store = new CredentialsStore({ path });
    await store.set("h", "p", { api_key: "k" });
    const first = await store.get("h", "p");
    const second = await store.get("h", "p");
    expect(first).toEqual(second);
  });

  it("expands ~ in the configured path", () => {
    const store = new CredentialsStore({ path: "~/some/where/hosts.yaml" });
    expect(store.filePath.startsWith("/")).toBe(true);
    expect(store.filePath).not.toContain("~");
  });
});
