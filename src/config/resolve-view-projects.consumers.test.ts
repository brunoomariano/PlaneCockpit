/**
 * Consumers: the CLI's single-project rule.
 *
 * The CLI (`plc issue list` without `--project`) stays single-project: it uses
 * the first project of `defaults.projects`. The TUI, on the other hand, lists
 * every project resolved from the view — that path is validated manually in the
 * TUI and covered indirectly by the aggregation tests.
 */

import { describe, it, expect } from "vitest";
import { firstDefaultProject } from "./resolve-view-projects.js";

describe("CLI default project", () => {
  it("should use the first of defaults.projects when the list has many", () => {
    expect(firstDefaultProject(["ENG", "OPS"])).toBe("ENG");
  });

  it("should use the single project when defaults.projects has one", () => {
    expect(firstDefaultProject(["ENG"])).toBe("ENG");
  });

  it("should return undefined when there are no default projects", () => {
    expect(firstDefaultProject(undefined)).toBeUndefined();
    expect(firstDefaultProject([])).toBeUndefined();
  });
});
