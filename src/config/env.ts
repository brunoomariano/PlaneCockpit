import type { PlaneConfig, ProfileConfig } from "../types/config.js";
import type { CredentialsStore } from "./credentials.js";
import { hostKey } from "./credentials.js";

export interface EnvOverrides {
  PLANE_BASE_URL?: string;
  PLANE_WORKSPACE_SLUG?: string;
  PLANE_API_KEY?: string;
  PLANE_TIMEOUT_MS?: string;
  PLANE_PROFILE?: string;
}

// applyEnvOverrides applies environment variable overrides on top of the parsed YAML config.
// Env vars never define a profile by themselves; they only override fields on the active profile.
export function applyEnvOverrides(
  config: PlaneConfig,
  env: EnvOverrides = process.env as EnvOverrides,
): PlaneConfig {
  const activeName = env.PLANE_PROFILE ?? config.active_profile;
  const baseProfile = config.profiles[activeName];
  if (!baseProfile) return { ...config, active_profile: activeName };

  const overridden: ProfileConfig = structuredClone(baseProfile);

  if (env.PLANE_BASE_URL) overridden.server.base_url = env.PLANE_BASE_URL;
  if (env.PLANE_WORKSPACE_SLUG) overridden.server.workspace_slug = env.PLANE_WORKSPACE_SLUG;
  if (env.PLANE_TIMEOUT_MS) {
    const parsed = Number.parseInt(env.PLANE_TIMEOUT_MS, 10);
    if (Number.isFinite(parsed) && parsed > 0) overridden.server.timeout_ms = parsed;
  }
  if (env.PLANE_API_KEY) overridden.auth = { ...overridden.auth, api_key: env.PLANE_API_KEY };

  return {
    active_profile: activeName,
    profiles: { ...config.profiles, [activeName]: overridden },
  };
}

export interface ResolveApiKeyParams {
  profileName: string;
  profile: ProfileConfig;
  env?: NodeJS.ProcessEnv;
  credentials?: CredentialsStore;
}

// Resolution order (highest priority first):
// 1. PLANE_API_KEY (already folded into profile.auth.api_key by applyEnvOverrides).
// 2. hosts.yaml entry keyed by (base_url + workspace_slug, profile_name).
// 3. auth.api_key_env from config — backwards-compatible env-var fallback.
export async function resolveApiKey(params: ResolveApiKeyParams): Promise<string | undefined> {
  const { profile, profileName, env = process.env, credentials } = params;
  if (profile.auth?.api_key) return profile.auth.api_key;
  if (credentials) {
    const host = hostKey(profile.server.base_url, profile.server.workspace_slug);
    const entry = await credentials.get(host, profileName);
    if (entry?.api_key) return entry.api_key;
  }
  const envVarName = profile.auth?.api_key_env;
  if (envVarName) {
    const fromEnv = env[envVarName];
    if (fromEnv && fromEnv.length > 0) return fromEnv;
  }
  return undefined;
}
