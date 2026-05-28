import { describe, it, expect } from "vitest";
import { cacheKeys, workspaceKey } from "./keys.js";

describe("cache keys", () => {
  it("namespaces under plane:<workspace>", () => {
    expect(workspaceKey("acme", "x", "y")).toBe("plane:acme:x:y");
  });

  it("builds project-scoped keys", () => {
    expect(cacheKeys.states("acme", "p1")).toBe("plane:acme:project:p1:states");
    expect(cacheKeys.issuesPage("acme", "p1", "abc")).toBe("plane:acme:project:p1:issues:abc");
  });

  it("isolates workspaces from each other", () => {
    expect(cacheKeys.users("a")).not.toBe(cacheKeys.users("b"));
  });
});
