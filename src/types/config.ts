import type { IssuePriority } from "./issue.js";
import type { SortKey, ViewLayout, ViewDefinition } from "./views.js";

export interface ServerConfig {
  base_url: string;
  workspace_slug: string;
  timeout_ms?: number;
  headers?: Record<string, string>;
  tls?: { reject_unauthorized?: boolean };
}

interface AuthConfig {
  api_key?: string;
}

interface RedisConfig {
  url: string;
  key_prefix?: string;
}

type CacheProvider = "memory" | "sqlite" | "redis" | "noop";

export interface CacheConfig {
  provider: CacheProvider;
  ttl?: number;
  redis?: RedisConfig;
  sqlite_path?: string;
}

export interface ProfileConfig {
  server: ServerConfig;
  auth?: AuthConfig;
  // projects is the profile's project universe. The TUI scans all of them by
  // default; the CLI (plc issue list without --project) uses the first one.
  // auto_refresh_seconds drives the TUI auto-refresh timer for every view
  // (omitted ⇒ 15s; 0 disables). sort is the profile-wide default sort,
  // inherited by views that declare no sort of their own.
  defaults?: {
    projects?: string[];
    auto_refresh_seconds?: number;
    sort?: SortKey[];
    layout?: ViewLayout;
    // Global state ordering for `sort: state` and quick-transition navigation:
    // an ordered list of state slugs (matched case-insensitively). Listed states
    // sort first in this order; unlisted ones follow by workflow group.
    state_order?: string[];
  };
  cache?: CacheConfig;
  // Optional theme: a built-in preset plus per-token color overrides. Resolved
  // into a concrete Theme by resolveTheme; absent ⇒ the default preset.
  theme?: ThemeConfigInput;
  views?: ViewDefinition[];
}

// Theme config as written in YAML (pre-resolution). Mirrors the Zod themeSchema.
// Colors are hex, named, or ANSI-256 index strings; all optional overrides.
export interface ThemeConfigInput {
  preset?: "default" | "catppuccin" | "gruvbox" | "tokyonight";
  colors?: {
    selection?: string;
    accent?: string;
    danger?: string;
    warning?: string;
    success?: string;
    muted?: string;
    priority?: Partial<Record<IssuePriority, string>>;
  };
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
