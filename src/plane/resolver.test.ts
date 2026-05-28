import { describe, it, expect } from "vitest";
import { IssueResolver } from "./resolver.js";
import { NotFoundError, PlaneCliError } from "../utils/errors.js";
import { stubProjects, stubWorkItems } from "../tests/stubs.js";
import type { Issue } from "../types/issue.js";
import type { Project } from "../types/project.js";

const project: Project = { id: "p-eng", identifier: "ENG", name: "Engineering", workspace_id: "w" };
const issue: Issue = {
  id: "uuid-123",
  sequence_id: 123,
  project_identifier: "ENG",
  key: "ENG-123",
  name: "Test",
  state: { id: "s", name: "Todo", group: "unstarted" },
  priority: "medium",
  assignees: [],
  labels: [],
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
};

const resolver = new IssueResolver(stubProjects([project]), stubWorkItems([issue]));

describe("IssueResolver", () => {
  it("parses a valid key", () => {
    expect(resolver.parseKey("ENG-123")).toEqual({ identifier: "ENG", sequence: 123 });
  });

  it("trims whitespace", () => {
    expect(resolver.parseKey("  ENG-1  ")).toEqual({ identifier: "ENG", sequence: 1 });
  });

  it("rejects invalid keys", () => {
    expect(() => resolver.parseKey("eng-1")).toThrow(PlaneCliError);
    expect(() => resolver.parseKey("ENG-")).toThrow(PlaneCliError);
    expect(() => resolver.parseKey("123")).toThrow(PlaneCliError);
  });

  it("resolves a key to project + uuid", async () => {
    const resolved = await resolver.resolve("ENG-123");
    expect(resolved.project.id).toBe("p-eng");
    expect(resolved.issueId).toBe("uuid-123");
  });

  it("throws NotFoundError when sequence does not exist", async () => {
    await expect(resolver.resolve("ENG-999")).rejects.toBeInstanceOf(NotFoundError);
  });
});
