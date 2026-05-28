import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyEnvOverrides, resolveApiKey } from "./env.js";
import { CredentialsStore, hostKey } from "./credentials.js";
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
    expect(p?.auth?.api_key).toBe("k");
  });

  it("ignores invalid timeout values", () => {
    const result = applyEnvOverrides(baseConfig, { PLANE_TIMEOUT_MS: "abc" });
    expect(result.profiles.production?.server.timeout_ms).toBe(5000);
  });

  it("does not mutate the input config", () => {
    applyEnvOverrides(baseConfig, { PLANE_API_KEY: "leak" });
    expect(baseConfig.profiles.production?.auth?.api_key).toBeUndefined();
  });

  it("still switches active_profile even when the named profile does not exist", () => {
    const result = applyEnvOverrides(baseConfig, { PLANE_PROFILE: "ghost" });
    expect(result.active_profile).toBe("ghost");
    expect(result.profiles.ghost).toBeUndefined();
  });
});

describe("resolveApiKey", () => {
  let credentialsPath: string;
  beforeEach(() => {
    credentialsPath = join(mkdtempSync(join(tmpdir(), "plane-cli-env-")), "hosts.yaml");
  });

  it("prefers profile.auth.api_key (env override) over everything else", async () => {
    const profile = {
      ...baseConfig.profiles.production!,
      auth: { api_key_env: "PLANE_API_KEY", api_key: "direct" },
    };
    const credentials = new CredentialsStore({ path: credentialsPath });
    await credentials.set(
      hostKey(profile.server.base_url, profile.server.workspace_slug),
      "production",
      { api_key: "from-hosts" },
    );
    const got = await resolveApiKey({
      profileName: "production",
      profile,
      env: { PLANE_STAGING_API_KEY: "ignored" },
      credentials,
    });
    expect(got).toBe("direct");
  });

  it("reads from hosts.yaml when no env override is present", async () => {
    const profile = baseConfig.profiles.production!;
    const credentials = new CredentialsStore({ path: credentialsPath });
    await credentials.set(
      hostKey(profile.server.base_url, profile.server.workspace_slug),
      "production",
      { api_key: "from-hosts" },
    );
    const got = await resolveApiKey({
      profileName: "production",
      profile,
      env: {},
      credentials,
    });
    expect(got).toBe("from-hosts");
  });

  it("falls back to api_key_env when hosts.yaml has nothing", async () => {
    const profile = baseConfig.profiles.production!;
    const credentials = new CredentialsStore({ path: credentialsPath });
    const got = await resolveApiKey({
      profileName: "production",
      profile,
      env: { PLANE_API_KEY: "from-env" },
      credentials,
    });
    expect(got).toBe("from-env");
  });

  it("works without a credentials store", async () => {
    const profile = baseConfig.profiles.production!;
    const got = await resolveApiKey({
      profileName: "production",
      profile,
      env: { PLANE_API_KEY: "from-env" },
    });
    expect(got).toBe("from-env");
  });

  it("returns undefined when nothing yields a key", async () => {
    const profile: typeof baseConfig.profiles.production = {
      ...baseConfig.profiles.production!,
      auth: undefined,
    };
    const got = await resolveApiKey({ profileName: "production", profile, env: {} });
    expect(got).toBeUndefined();
  });

  it("returns undefined when api_key_env points at an empty variable", async () => {
    const profile = baseConfig.profiles.production!;
    const got = await resolveApiKey({
      profileName: "production",
      profile,
      env: { PLANE_API_KEY: "" },
    });
    expect(got).toBeUndefined();
  });
});
