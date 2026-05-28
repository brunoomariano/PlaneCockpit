import { describe, it, expect } from "vitest";
import { applyEnvOverrides, resolveApiKey } from "./env.js";
import type { PlaneConfig } from "../types/config.js";

const baseConfig: PlaneConfig = {
  active_profile: "production",
  profiles: {
    production: {
      server: { base_url: "https://plane.example.com", workspace_slug: "acme", timeout_ms: 5000 },
      auth: { api_key_env: "PLANE_API_KEY" },
    },
    staging: {
      server: { base_url: "https://staging.example.com", workspace_slug: "acme-stg" },
      auth: { api_key_env: "PLANE_STAGING_API_KEY" },
    },
  },
};

describe("applyEnvOverrides", () => {
  it("returns config unchanged when no envs are set", () => {
    const result = applyEnvOverrides(baseConfig, {});
    expect(result.profiles.production?.server.base_url).toBe("https://plane.example.com");
  });

  it("switches active profile via PLANE_PROFILE", () => {
    const result = applyEnvOverrides(baseConfig, { PLANE_PROFILE: "staging" });
    expect(result.active_profile).toBe("staging");
  });

  it("overrides base_url, workspace_slug, timeout and api_key on the active profile", () => {
    const result = applyEnvOverrides(baseConfig, {
      PLANE_BASE_URL: "https://override.example.com",
      PLANE_WORKSPACE_SLUG: "other",
      PLANE_TIMEOUT_MS: "1500",
      PLANE_API_KEY: "k",
    });
    const p = result.profiles.production;
    expect(p?.server.base_url).toBe("https://override.example.com");
    expect(p?.server.workspace_slug).toBe("other");
    expect(p?.server.timeout_ms).toBe(1500);
    expect(p?.auth.api_key).toBe("k");
  });

  it("ignores invalid timeout values", () => {
    const result = applyEnvOverrides(baseConfig, { PLANE_TIMEOUT_MS: "abc" });
    expect(result.profiles.production?.server.timeout_ms).toBe(5000);
  });

  it("does not mutate the input config", () => {
    applyEnvOverrides(baseConfig, { PLANE_API_KEY: "leak" });
    expect(baseConfig.profiles.production?.auth.api_key).toBeUndefined();
  });
});

describe("resolveApiKey", () => {
  it("prefers profile.auth.api_key when set", () => {
    const profile = { ...baseConfig.profiles.production!, auth: { api_key_env: "X", api_key: "direct" } };
    expect(resolveApiKey(profile, {})).toBe("direct");
  });

  it("falls back to env variable", () => {
    const profile = baseConfig.profiles.production!;
    expect(resolveApiKey(profile, { PLANE_API_KEY: "from-env" })).toBe("from-env");
  });

  it("returns undefined when neither is set", () => {
    const profile = baseConfig.profiles.production!;
    expect(resolveApiKey(profile, {})).toBeUndefined();
  });
});
