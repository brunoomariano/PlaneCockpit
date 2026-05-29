import { describe, it, expect } from "vitest";
import { cacheKeys, workspaceKey } from "./keys.js";

describe("cache keys", () => {
  it("namespaces under plane:<workspace>", () => {
    expect(workspaceKey("acme", "x", "y")).toBe("plane:acme:x:y");
  });

  it("builds projects and project keys", () => {
    expect(cacheKeys.projects("acme")).toBe("plane:acme:projects");
    expect(cacheKeys.project("acme", "ENG")).toBe("plane:acme:project:ENG");
  });

  it("builds project-scoped issue page keys", () => {
    expect(cacheKeys.issuesPage("acme", "p1", "abc")).toBe("plane:acme:project:p1:issues:abc");
  });

  it("builds workspace-scoped user keys", () => {
    expect(cacheKeys.users("acme")).toBe("plane:acme:users");
  });

  it("isolates workspaces from each other", () => {
    expect(cacheKeys.users("a")).not.toBe(cacheKeys.users("b"));
  });
});
