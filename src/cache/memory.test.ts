import { describe, it, expect } from "vitest";
import { MemoryCacheStore } from "./memory.js";

describe("MemoryCacheStore", () => {
  it("stores and retrieves values", async () => {
    const store = new MemoryCacheStore();
    await store.set("k", { v: 1 });
    expect(await store.get<{ v: number }>("k")).toEqual({ v: 1 });
  });

  it("returns null for missing keys", async () => {
    const store = new MemoryCacheStore();
    expect(await store.get("missing")).toBeNull();
  });

  it("expires entries based on ttl", async () => {
    let nowValue = 1_000;
    const store = new MemoryCacheStore({ now: () => nowValue });
    await store.set("k", "v", 1);
    expect(await store.get("k")).toBe("v");
    nowValue += 2_000;
    expect(await store.get("k")).toBeNull();
  });

  it("clears all entries", async () => {
    const store = new MemoryCacheStore();
    await store.set("a", 1);
    await store.set("b", 2);
    await store.clear();
    expect(await store.size()).toBe(0);
  });

  it("clears entries by prefix", async () => {
    const store = new MemoryCacheStore();
    await store.set("p:a", 1);
    await store.set("p:b", 2);
    await store.set("q:c", 3);
    await store.clear("p:");
    expect(await store.get("p:a")).toBeNull();
    expect(await store.get("p:b")).toBeNull();
    expect(await store.get("q:c")).toBe(3);
  });

  it("deletes a single key", async () => {
    const store = new MemoryCacheStore();
    await store.set("k", 1);
    await store.del("k");
    expect(await store.get("k")).toBeNull();
  });
});
