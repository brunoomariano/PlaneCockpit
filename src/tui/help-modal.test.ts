import { describe, it, expect } from "vitest";
import { buildHelpSections } from "./help-modal.js";
import { resolveBindings } from "../keybindings/load.js";

const bindings = resolveBindings({});

function rowIds(sections: ReturnType<typeof buildHelpSections>): string[] {
  return sections.flatMap((s) => s.rows.flatMap((r) => r.ids));
}

describe("buildHelpSections", () => {
  it("puts shared list/detail vertical navigation in a single Navigation section", () => {
    const sections = buildHelpSections(bindings, "");
    const titles = sections.map((s) => s.title);
    expect(titles[0]).toBe("Navigation");

    const nav = sections.find((s) => s.title === "Navigation")!;
    // "move down" merges j/down (list) and j/down (detail scroll) into one row.
    const moveDown = nav.rows.find((r) => r.label === "move down")!;
    expect(moveDown.ids).toEqual([
      "list.next",
      "list.next-alt",
      "detail.scroll-down",
      "detail.scroll-down-alt",
    ]);
    expect(moveDown.keys).toBe("j/down");
  });

  it("pairs opposite navigation actions on one row", () => {
    const sections = buildHelpSections(bindings, "");
    const nav = sections.find((s) => s.title === "Navigation")!;
    const topBottom = nav.rows.find((r) => r.label === "top / bottom")!;
    expect(topBottom.keys).toBe("g/G");
    expect(topBottom.ids).toEqual(["list.top", "detail.top", "list.bottom", "detail.bottom"]);
  });

  it("merges a primary key with its arrow alternate in the same row", () => {
    const sections = buildHelpSections(bindings, "");
    const views = sections.find((s) => s.title === "Views")!;
    const nextPrev = views.rows.filter((r) => r.ids.includes("view.next"));
    expect(nextPrev).toHaveLength(1);
    expect(nextPrev[0]!.keys).toBe("]/right");
    expect(nextPrev[0]!.ids).toEqual(["view.next", "view.next-alt"]);
  });

  it("does not leave navigation actions in the per-context sections", () => {
    const sections = buildHelpSections(bindings, "");
    const issueList = sections.find((s) => s.title === "Issue list");
    const listIds = issueList?.rows.flatMap((r) => r.ids) ?? [];
    // open-detail and open-browser stay; vertical nav moved to Navigation.
    expect(listIds).toContain("list.open-detail");
    expect(listIds).not.toContain("list.next");
    expect(listIds).not.toContain("list.page-down");
  });

  it("filters by description substring", () => {
    const sections = buildHelpSections(bindings, "in browser");
    const ids = rowIds(sections);
    expect(ids).toContain("list.open-browser");
    expect(ids).toContain("detail.open-browser");
  });

  it("filters by action id", () => {
    const sections = buildHelpSections(bindings, "list.page-down");
    expect(rowIds(sections)).toEqual(["list.page-down"]);
  });

  it("filters by key", () => {
    const sections = buildHelpSections(bindings, "?");
    expect(rowIds(sections)).toContain("global.help");
  });

  it("returns an empty list when nothing matches", () => {
    expect(buildHelpSections(bindings, "zzz-nope")).toEqual([]);
  });
});
