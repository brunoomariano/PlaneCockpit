import { describe, it, expect } from "vitest";
import { cacheKeys, workspaceKey } from "./keys.js";

describe("cache keys", () => {
  it("namespaces under plane:<workspace>", () => {
    expect(workspaceKey("acme", "x", "y")).toBe("plane:acme:x:y");
  });

  it("builds workspace and projects keys", () => {
    expect(cacheKeys.workspace("acme")).toBe("plane:acme:workspace");
    expect(cacheKeys.projects("acme")).toBe("plane:acme:projects");
    expect(cacheKeys.project("acme", "ENG")).toBe("plane:acme:project:ENG");
  });

  it("builds project-scoped keys", () => {
    expect(cacheKeys.states("acme", "p1")).toBe("plane:acme:project:p1:states");
    expect(cacheKeys.labels("acme", "p1")).toBe("plane:acme:project:p1:labels");
    expect(cacheKeys.cycles("acme", "p1")).toBe("plane:acme:project:p1:cycles");
    expect(cacheKeys.modules("acme", "p1")).toBe("plane:acme:project:p1:modules");
    expect(cacheKeys.issuesPage("acme", "p1", "abc")).toBe("plane:acme:project:p1:issues:abc");
  });

  it("builds workspace-scoped keys", () => {
    expect(cacheKeys.users("acme")).toBe("plane:acme:users");
    expect(cacheKeys.issueLookup("acme", "ENG-1")).toBe("plane:acme:lookup:ENG-1");
    expect(cacheKeys.views("acme")).toBe("plane:acme:views");
  });

  it("isolates workspaces from each other", () => {
    expect(cacheKeys.users("a")).not.toBe(cacheKeys.users("b"));
  });
});
