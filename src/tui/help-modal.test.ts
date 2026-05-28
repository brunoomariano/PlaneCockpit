import { describe, it, expect } from "vitest";
import { groupAndFilter } from "./help-modal.js";
import { resolveBindings } from "../keybindings/load.js";

const bindings = resolveBindings({});

describe("groupAndFilter", () => {
  it("groups every binding by context when query is empty", () => {
    const groups = groupAndFilter(bindings, "");
    const contexts = groups.map((g) => g.context);
    expect(contexts).toContain("global");
    expect(contexts).toContain("list");
    expect(contexts).toContain("view");
    expect(contexts).toContain("filter");
    expect(contexts).toContain("help");
    expect(contexts).toContain("detail");
  });

  it("filters by description substring", () => {
    const groups = groupAndFilter(bindings, "in browser");
    const flat = groups.flatMap((g) => g.bindings.map((b) => b.action.id));
    expect(flat).toContain("list.open-browser");
    expect(flat).toContain("detail.open-browser");
  });

  it("filters by action id", () => {
    const groups = groupAndFilter(bindings, "list.page-down");
    const flat = groups.flatMap((g) => g.bindings.map((b) => b.action.id));
    expect(flat).toEqual(["list.page-down"]);
  });

  it("filters by key", () => {
    const groups = groupAndFilter(bindings, "?");
    const flat = groups.flatMap((g) => g.bindings.map((b) => b.action.id));
    expect(flat).toContain("global.help");
  });

  it("returns an empty list when nothing matches", () => {
    expect(groupAndFilter(bindings, "zzz-nope")).toEqual([]);
  });
});
