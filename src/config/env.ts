import type { ProfileConfig } from "../types/config.js";
import type { CredentialsStore } from "./credentials.js";
import { hostKey } from "./credentials.js";

export interface ResolveApiKeyParams {
  profileName: string;
  profile: ProfileConfig;
  credentials?: CredentialsStore;
}

// Resolution order (highest priority first):
// 1. auth.api_key inline in config.yaml.
// 2. hosts.yaml entry keyed by (base_url + workspace_slug, profile_name),
//    written by `plc auth login`.
export async function resolveApiKey(params: ResolveApiKeyParams): Promise<string | undefined> {
  const { profile, profileName, credentials } = params;
  if (profile.auth?.api_key) return profile.auth.api_key;
  if (credentials) {
    const host = hostKey(profile.server.base_url, profile.server.workspace_slug);
    const entry = await credentials.get(host, profileName);
    if (entry?.api_key) return entry.api_key;
  }
  return undefined;
}
