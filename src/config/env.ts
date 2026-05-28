import type { PlaneConfig, ProfileConfig } from "../types/config.js";

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
  if (env.PLANE_API_KEY) overridden.auth.api_key = env.PLANE_API_KEY;

  return {
    active_profile: activeName,
    profiles: { ...config.profiles, [activeName]: overridden },
  };
}

export function resolveApiKey(profile: ProfileConfig, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (profile.auth.api_key) return profile.auth.api_key;
  const fromEnv = env[profile.auth.api_key_env];
  return fromEnv && fromEnv.length > 0 ? fromEnv : undefined;
}
