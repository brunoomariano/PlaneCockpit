import type { CacheStore } from "./types.js";

export class NoopCacheStore implements CacheStore {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }
  async set<T>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> {}
  async del(_key: string): Promise<void> {}
  async clear(_prefix?: string): Promise<void> {}
  async size(): Promise<number> {
    return 0;
  }
}
