import { describe, it, expect } from "vitest";
import { listProfiles, selectProfile, withActiveProfile } from "./profiles.js";
import { ConfigError } from "../utils/errors.js";
import type { PlaneConfig } from "../types/config.js";

const cfg: PlaneConfig = {
  active_profile: "production",
  profiles: {
    production: {
      server: { base_url: "https://plane.example.com", workspace_slug: "acme" },
    },
    staging: {
      server: { base_url: "https://staging.example.com", workspace_slug: "acme-stg" },
    },
  },
};

describe("profiles", () => {
  it("listProfiles returns sorted names", () => {
    expect(listProfiles(cfg)).toEqual(["production", "staging"]);
  });

  it("selectProfile returns the active profile by default", () => {
    expect(selectProfile(cfg).name).toBe("production");
  });

  it("selectProfile honors override", () => {
    expect(selectProfile(cfg, "staging").name).toBe("staging");
  });

  it("selectProfile throws when profile not found", () => {
    expect(() => selectProfile(cfg, "missing")).toThrow(ConfigError);
  });

  it("withActiveProfile switches the active profile", () => {
    expect(withActiveProfile(cfg, "staging").active_profile).toBe("staging");
  });

  it("withActiveProfile rejects unknown profile", () => {
    expect(() => withActiveProfile(cfg, "ghost")).toThrow(ConfigError);
  });
});
