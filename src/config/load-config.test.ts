import { describe, it, expect } from "vitest";
import { parseConfig } from "./load-config.js";
import { ConfigError } from "../utils/errors.js";

const validYaml = `
active_profile: production
profiles:
  production:
    server:
      base_url: https://plane.example.com
      workspace_slug: acme
    auth:
      api_key_env: PLANE_API_KEY
`;

describe("parseConfig", () => {
  it("parses a minimal valid config", () => {
    const cfg = parseConfig(validYaml);
    expect(cfg.active_profile).toBe("production");
    expect(cfg.profiles.production?.server.workspace_slug).toBe("acme");
  });

  it("rejects when active_profile is missing from profiles", () => {
    const bad = `
active_profile: staging
profiles:
  production:
    server:
      base_url: https://plane.example.com
      workspace_slug: acme
    auth:
      api_key_env: PLANE_API_KEY
`;
    expect(() => parseConfig(bad)).toThrow(ConfigError);
  });

  it("rejects invalid base_url", () => {
    const bad = `
active_profile: p
profiles:
  p:
    server:
      base_url: not-a-url
      workspace_slug: acme
    auth:
      api_key_env: PLANE_API_KEY
`;
    expect(() => parseConfig(bad)).toThrow(ConfigError);
  });

  it("rejects malformed YAML", () => {
    expect(() => parseConfig("::not yaml::")).toThrow(ConfigError);
  });
});
