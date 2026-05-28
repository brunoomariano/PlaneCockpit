import { describe, it, expect } from "vitest";
import { createCacheStore } from "./factory.js";
import { NoopCacheStore } from "./noop.js";
import { MemoryCacheStore } from "./memory.js";
import { ConfigError } from "../utils/errors.js";
import type { CacheConfig } from "../types/config.js";

describe("createCacheStore", () => {
  it("returns NoopCacheStore when disabled", async () => {
    const store = await createCacheStore({ disabled: true });
    expect(store).toBeInstanceOf(NoopCacheStore);
  });

  it("defaults to memory when no config is provided", async () => {
    const store = await createCacheStore({});
    expect(store).toBeInstanceOf(MemoryCacheStore);
  });

  it("returns MemoryCacheStore when provider is memory", async () => {
    const store = await createCacheStore({ config: { provider: "memory" } });
    expect(store).toBeInstanceOf(MemoryCacheStore);
  });

  it("returns NoopCacheStore when provider is noop", async () => {
    const store = await createCacheStore({ config: { provider: "noop" } });
    expect(store).toBeInstanceOf(NoopCacheStore);
  });

  it("rejects redis provider when url is missing", async () => {
    await expect(createCacheStore({ config: { provider: "redis" } })).rejects.toBeInstanceOf(
      ConfigError,
    );
  });

  it("throws for an unknown provider", async () => {
    const bad = { provider: "ghost" } as unknown as CacheConfig;
    await expect(createCacheStore({ config: bad })).rejects.toBeInstanceOf(ConfigError);
  });

  it("builds a sqlite store with an in-memory path", async () => {
    const store = await createCacheStore({
      config: { provider: "sqlite", sqlite_path: ":memory:" },
    });
    await store.set("k", { v: 1 });
    expect(await store.get<{ v: number }>("k")).toEqual({ v: 1 });
    if (store.close) await store.close();
  });
});
