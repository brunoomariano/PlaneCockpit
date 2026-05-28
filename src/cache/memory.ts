import type { CacheStore } from "./types.js";

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

export interface MemoryCacheOptions {
  defaultTtlSeconds?: number;
  now?: () => number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, Entry>();
  private readonly defaultTtl: number | undefined;
  private readonly now: () => number;

  constructor(opts: MemoryCacheOptions = {}) {
    this.defaultTtl = opts.defaultTtlSeconds;
    this.now = opts.now ?? Date.now;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    const expiresAt = ttl !== undefined && ttl > 0 ? this.now() + ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  async size(): Promise<number> {
    return this.store.size;
  }
}
