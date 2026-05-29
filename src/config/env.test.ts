import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveApiKey } from "./env.js";
import { CredentialsStore, hostKey } from "./credentials.js";
import type { PlaneConfig } from "../types/config.js";

const baseConfig: PlaneConfig = {
  active_profile: "production",
  profiles: {
    production: {
      server: { base_url: "https://plane.example.com", workspace_slug: "acme", timeout_ms: 5000 },
    },
    staging: {
      server: { base_url: "https://staging.example.com", workspace_slug: "acme-stg" },
    },
  },
};

describe("resolveApiKey", () => {
  let credentialsPath: string;
  beforeEach(() => {
    credentialsPath = join(mkdtempSync(join(tmpdir(), "plane-cli-env-")), "hosts.yaml");
  });

  it("prefers an inline profile.auth.api_key over hosts.yaml", async () => {
    const profile = {
      ...baseConfig.profiles.production!,
      auth: { api_key: "direct" },
    };
    const credentials = new CredentialsStore({ path: credentialsPath });
    await credentials.set(
      hostKey(profile.server.base_url, profile.server.workspace_slug),
      "production",
      { api_key: "from-hosts" },
    );
    const got = await resolveApiKey({ profileName: "production", profile, credentials });
    expect(got).toBe("direct");
  });

  it("reads from hosts.yaml when no inline key is present", async () => {
    const profile = baseConfig.profiles.production!;
    const credentials = new CredentialsStore({ path: credentialsPath });
    await credentials.set(
      hostKey(profile.server.base_url, profile.server.workspace_slug),
      "production",
      { api_key: "from-hosts" },
    );
    const got = await resolveApiKey({ profileName: "production", profile, credentials });
    expect(got).toBe("from-hosts");
  });

  it("works without a credentials store", async () => {
    const profile = { ...baseConfig.profiles.production!, auth: { api_key: "direct" } };
    const got = await resolveApiKey({ profileName: "production", profile });
    expect(got).toBe("direct");
  });

  it("returns undefined when nothing yields a key", async () => {
    const profile = baseConfig.profiles.production!;
    const credentials = new CredentialsStore({ path: credentialsPath });
    const got = await resolveApiKey({ profileName: "production", profile, credentials });
    expect(got).toBeUndefined();
  });
});
