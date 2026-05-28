import { describe, it, expect } from "vitest";
import { SqliteCacheStore } from "./sqlite.js";

async function openStore(now?: () => number): Promise<SqliteCacheStore> {
  return SqliteCacheStore.open({ path: ":memory:", defaultTtlSeconds: 60, now });
}

describe("SqliteCacheStore", () => {
  it("stores and retrieves values", async () => {
    const store = await openStore();
    await store.set("k", { v: 1 });
    expect(await store.get<{ v: number }>("k")).toEqual({ v: 1 });
    await store.close();
  });

  it("returns null for missing keys", async () => {
    const store = await openStore();
    expect(await store.get("missing")).toBeNull();
    await store.close();
  });

  it("upserts on set", async () => {
    const store = await openStore();
    await store.set("k", 1);
    await store.set("k", 2);
    expect(await store.get("k")).toBe(2);
    await store.close();
  });

  it("expires entries based on ttl", async () => {
    let now = 1_000;
    const store = await openStore(() => now);
    await store.set("k", "v", 1);
    expect(await store.get("k")).toBe("v");
    now += 2_000;
    expect(await store.get("k")).toBeNull();
    await store.close();
  });

  it("clears all entries when no prefix is given", async () => {
    const store = await openStore();
    await store.set("a", 1);
    await store.set("b", 2);
    await store.clear();
    expect(await store.size()).toBe(0);
    await store.close();
  });

  it("clears entries by prefix", async () => {
    const store = await openStore();
    await store.set("p:a", 1);
    await store.set("p:b", 2);
    await store.set("q:c", 3);
    await store.clear("p:");
    expect(await store.get("p:a")).toBeNull();
    expect(await store.get("q:c")).toBe(3);
    await store.close();
  });

  it("deletes a single key", async () => {
    const store = await openStore();
    await store.set("k", 1);
    await store.del("k");
    expect(await store.get("k")).toBeNull();
    await store.close();
  });

  it("reports size", async () => {
    const store = await openStore();
    await store.set("a", 1);
    await store.set("b", 2);
    expect(await store.size()).toBe(2);
    await store.close();
  });

  it("set with ttl=0 stores without expiration", async () => {
    let now = 1_000;
    const store = await openStore(() => now);
    await store.set("k", "v", 0);
    now += 10_000_000;
    expect(await store.get("k")).toBe("v");
    await store.close();
  });
});
