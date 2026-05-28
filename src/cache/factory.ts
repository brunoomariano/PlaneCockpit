import { homedir } from "node:os";
import { join } from "node:path";
import type { CacheConfig } from "../types/config.js";
import { MemoryCacheStore } from "./memory.js";
import { NoopCacheStore } from "./noop.js";
import { SqliteCacheStore } from "./sqlite.js";
import { RedisCacheStore } from "./redis.js";
import { DEFAULT_CACHE_TTL_SECONDS } from "../config/defaults.js";
import type { CacheStore } from "./types.js";
import { ConfigError } from "../utils/errors.js";

export interface CacheFactoryOptions {
  config?: CacheConfig;
  disabled?: boolean;
}

export async function createCacheStore(opts: CacheFactoryOptions): Promise<CacheStore> {
  if (opts.disabled) return new NoopCacheStore();
  const cfg = opts.config;
  if (!cfg) return new MemoryCacheStore({ defaultTtlSeconds: DEFAULT_CACHE_TTL_SECONDS });
  const ttl = cfg.ttl ?? DEFAULT_CACHE_TTL_SECONDS;
  switch (cfg.provider) {
    case "noop":
      return new NoopCacheStore();
    case "memory":
      return new MemoryCacheStore({ defaultTtlSeconds: ttl });
    case "sqlite": {
      const path = cfg.sqlite_path ?? join(homedir(), ".cache", "plane-cli", "cache.sqlite");
      return SqliteCacheStore.open({ path, defaultTtlSeconds: ttl });
    }
    case "redis": {
      if (!cfg.redis?.url) throw new ConfigError("cache.redis.url is required for redis provider");
      return RedisCacheStore.open({
        url: cfg.redis.url,
        keyPrefix: cfg.redis.key_prefix,
        defaultTtlSeconds: ttl,
      });
    }
    default:
      throw new ConfigError(`unknown cache provider: ${(cfg as { provider: string }).provider}`);
  }
}
