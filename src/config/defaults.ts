import type { CacheConfig } from "../types/config.js";

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_CACHE_TTL_SECONDS = 300;
export const DEFAULT_CONFIG_PATHS = [
  "~/.config/plane-cli/config.yaml",
  "~/.plane/config.yaml",
] as const;

export const DEFAULT_CACHE: CacheConfig = {
  provider: "memory",
  ttl: DEFAULT_CACHE_TTL_SECONDS,
};
