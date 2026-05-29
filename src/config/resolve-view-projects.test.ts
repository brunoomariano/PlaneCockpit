/**
 * Resolving a view's set of projects.
 *
 * `resolveViewProjects(view, defaultProjects)` decides which project identifiers
 * a view queries: when the view declares no `projects`, it inherits the profile
 * universe (`defaults.projects`); when it declares them, it uses the subset,
 * which must be contained in the universe. Items outside the universe are a
 * config error.
 */

import { describe, it, expect } from "vitest";
import {
  resolveViewProjects,
  resolveViewProjectsLenient,
  buildViewEntries,
} from "./resolve-view-projects.js";
import { ConfigError } from "../utils/errors.js";

describe("resolveViewProjects (strict, used by the CLI)", () => {
  it("should inherit all profile projects when the view declares none", () => {
    const out = resolveViewProjects({ name: "All" }, ["ENG", "OPS"]);
    expect(out).toEqual(["ENG", "OPS"]);
  });

  it("should restrict to the declared subset when the view lists projects", () => {
    const out = resolveViewProjects({ name: "Eng", projects: ["ENG"] }, ["ENG", "OPS"]);
    expect(out).toEqual(["ENG"]);
  });

  it("should throw when a declared project is outside the profile universe", () => {
    expect(() => resolveViewProjects({ name: "X", projects: ["GHOST"] }, ["ENG", "OPS"])).toThrow(
      ConfigError,
    );
  });

  it("should resolve to the single profile project for a view without projects", () => {
    const out = resolveViewProjects({ name: "Solo" }, ["ENG"]);
    expect(out).toEqual(["ENG"]);
  });
});

describe("resolveViewProjectsLenient (lenient, used by the TUI)", () => {
  it("should inherit all projects and not be marked restricted when the view declares none", () => {
    const out = resolveViewProjectsLenient({ name: "All" }, ["ENG", "OPS"]);
    expect(out).toEqual({ projects: ["ENG", "OPS"], invalid: [], restricted: false });
  });

  it("should mark a valid subset as restricted with no invalid projects", () => {
    const out = resolveViewProjectsLenient({ name: "Eng", projects: ["ENG"] }, ["ENG", "OPS"]);
    expect(out).toEqual({ projects: ["ENG"], invalid: [], restricted: true });
  });

  it("should ignore projects outside the universe and report them as invalid", () => {
    const out = resolveViewProjectsLenient({ name: "Mixed", projects: ["ENG", "GHOST"] }, [
      "ENG",
      "OPS",
    ]);
    expect(out).toEqual({ projects: ["ENG"], invalid: ["GHOST"], restricted: true });
  });

  it("should resolve to an empty project list when every declared project is invalid", () => {
    const out = resolveViewProjectsLenient({ name: "AllBad", projects: ["GHOST", "NOPE"] }, [
      "ENG",
      "OPS",
    ]);
    expect(out).toEqual({ projects: [], invalid: ["GHOST", "NOPE"], restricted: true });
  });
});

describe("buildViewEntries (navbar markers)", () => {
  const universe = ["ENG", "OPS"];

  it("should not flag a view that inherits all projects", () => {
    const [entry] = buildViewEntries([{ name: "All" }], universe);
    expect(entry).toEqual({ name: "All", restricted: false, hasErrors: false });
  });

  it("should flag '#' (restricted) for a view with a valid subset", () => {
    const [entry] = buildViewEntries([{ name: "Eng", projects: ["ENG"] }], universe);
    expect(entry).toEqual({ name: "Eng", restricted: true, hasErrors: false });
  });

  it("should flag '*' (hasErrors) for a view referencing an unknown project", () => {
    const [entry] = buildViewEntries([{ name: "Bad", projects: ["ENG", "GHOST"] }], universe);
    expect(entry).toEqual({ name: "Bad", restricted: true, hasErrors: true });
  });

  it("should flag '*' even when every declared project is invalid", () => {
    const [entry] = buildViewEntries([{ name: "AllBad", projects: ["GHOST"] }], universe);
    expect(entry).toEqual({ name: "AllBad", restricted: true, hasErrors: true });
  });

  it("should keep each view's markers independent", () => {
    const entries = buildViewEntries(
      [{ name: "All" }, { name: "Eng", projects: ["ENG"] }, { name: "Bad", projects: ["GHOST"] }],
      universe,
    );
    expect(entries.map((e) => [e.restricted, e.hasErrors])).toEqual([
      [false, false],
      [true, false],
      [true, true],
    ]);
  });
});
