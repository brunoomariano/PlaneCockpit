import type { PlaneConfig, ProfileConfig } from "../types/config.js";
import { ConfigError } from "../utils/errors.js";

export function listProfiles(config: PlaneConfig): string[] {
  return Object.keys(config.profiles).sort();
}

export function selectProfile(
  config: PlaneConfig,
  override?: string,
): { name: string; profile: ProfileConfig } {
  const name = override ?? config.active_profile;
  const profile = config.profiles[name];
  if (!profile) {
    throw new ConfigError(`profile not found: ${name}`, {
      available: listProfiles(config),
    });
  }
  return { name, profile };
}

export function withActiveProfile(config: PlaneConfig, name: string): PlaneConfig {
  if (!config.profiles[name]) {
    throw new ConfigError(`profile not found: ${name}`, {
      available: listProfiles(config),
    });
  }
  return { ...config, active_profile: name };
}
