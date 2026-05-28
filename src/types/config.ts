import type { ViewDefinition } from "./views.js";

export interface ServerConfig {
  base_url: string;
  workspace_slug: string;
  timeout_ms?: number;
  headers?: Record<string, string>;
  tls?: { reject_unauthorized?: boolean };
}

export interface AuthConfig {
  api_key_env: string;
  api_key?: string;
}

export interface RedisConfig {
  url: string;
  key_prefix?: string;
}

export type CacheProvider = "memory" | "sqlite" | "redis" | "noop";

export interface CacheConfig {
  provider: CacheProvider;
  ttl?: number;
  redis?: RedisConfig;
  sqlite_path?: string;
}

export interface ProfileConfig {
  server: ServerConfig;
  auth: AuthConfig;
  defaults?: { project?: string };
  cache?: CacheConfig;
  views?: ViewDefinition[];
}

export interface PlaneConfig {
  active_profile: string;
  profiles: Record<string, ProfileConfig>;
}

export interface RuntimeConfig {
  profile_name: string;
  profile: ProfileConfig;
  no_cache: boolean;
  debug: boolean;
}
