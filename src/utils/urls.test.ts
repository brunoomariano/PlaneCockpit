import { describe, it, expect } from "vitest";
import { buildCycleUrl, buildIssueUrl, buildProjectUrl, normalizeBaseUrl } from "./urls.js";
import { ConfigError } from "./errors.js";

const server = { base_url: "https://plane.example.com/", workspace_slug: "acme" };

describe("normalizeBaseUrl", () => {
  it("removes trailing slashes", () => {
    expect(normalizeBaseUrl("https://plane.example.com/")).toBe("https://plane.example.com");
    expect(normalizeBaseUrl("https://plane.example.com//")).toBe("https://plane.example.com");
  });

  it("rejects empty url", () => {
    expect(() => normalizeBaseUrl("")).toThrow(ConfigError);
  });

  it("rejects non-http(s) urls", () => {
    expect(() => normalizeBaseUrl("ftp://x")).toThrow(ConfigError);
  });

  it("rejects malformed urls", () => {
    expect(() => normalizeBaseUrl("not a url")).toThrow(ConfigError);
  });
});

describe("url builders", () => {
  it("buildProjectUrl includes workspace and project id", () => {
    expect(buildProjectUrl(server, { id: "p1" })).toBe(
      "https://plane.example.com/acme/projects/p1/issues",
    );
  });

  it("buildIssueUrl uses provided projectId override", () => {
    expect(buildIssueUrl(server, { id: "i1" }, "p1")).toBe(
      "https://plane.example.com/acme/projects/p1/issues/i1",
    );
  });

  it("buildIssueUrl uses issue.project_id when no override", () => {
    expect(buildIssueUrl(server, { id: "i1", project_id: "p1" })).toBe(
      "https://plane.example.com/acme/projects/p1/issues/i1",
    );
  });

  it("buildIssueUrl throws when no project id is available", () => {
    expect(() => buildIssueUrl(server, { id: "i1" })).toThrow(ConfigError);
  });

  it("buildCycleUrl includes project and cycle ids", () => {
    expect(buildCycleUrl(server, { id: "c1", project_id: "p1" })).toBe(
      "https://plane.example.com/acme/projects/p1/cycles/c1",
    );
  });
});
