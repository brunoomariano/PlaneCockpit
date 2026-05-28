import type { CacheStore } from "./types.js";

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  set(key: string, value: string, ex: "EX", ttl: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  scan(cursor: string, match: "MATCH", pattern: string, count: "COUNT", n: number): Promise<[string, string[]]>;
  dbsize(): Promise<number>;
  quit(): Promise<unknown>;
}

export interface RedisCacheOptions {
  url: string;
  keyPrefix?: string;
  defaultTtlSeconds?: number;
  client?: RedisLike;
}

export class RedisCacheStore implements CacheStore {
  private readonly client: RedisLike;
  private readonly prefix: string;
  private readonly defaultTtl: number | undefined;

  private constructor(client: RedisLike, opts: RedisCacheOptions) {
    this.client = client;
    this.prefix = opts.keyPrefix ? `${opts.keyPrefix}:` : "";
    this.defaultTtl = opts.defaultTtlSeconds;
  }

  static async open(opts: RedisCacheOptions): Promise<RedisCacheStore> {
    if (opts.client) return new RedisCacheStore(opts.client, opts);
    const mod = await import("ioredis");
    const Redis = mod.default;
    const client = new Redis(opts.url) as unknown as RedisLike;
    return new RedisCacheStore(client, opts);
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(this.k(key));
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    const payload = JSON.stringify(value);
    if (ttl !== undefined && ttl > 0) {
      await this.client.set(this.k(key), payload, "EX", ttl);
    } else {
      await this.client.set(this.k(key), payload);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.k(key));
  }

  async clear(prefix?: string): Promise<void> {
    const pattern = `${this.prefix}${prefix ?? ""}*`;
    let cursor = "0";
    do {
      const [next, keys] = await this.client.scan(cursor, "MATCH", pattern, "COUNT", 200);
      cursor = next;
      for (const k of keys) await this.client.del(k);
    } while (cursor !== "0");
  }

  async size(): Promise<number> {
    return this.client.dbsize();
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
