import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { expandHome } from "./paths.js";

describe("expandHome", () => {
  it("expands a leading ~/ to the home directory", () => {
    expect(expandHome("~/x/y")).toBe(`${homedir()}/x/y`);
  });

  it("expands a bare ~ to the home directory", () => {
    expect(expandHome("~")).toBe(homedir());
  });

  it("leaves absolute and relative paths untouched", () => {
    expect(expandHome("/etc/config")).toBe("/etc/config");
    expect(expandHome("relative/path")).toBe("relative/path");
  });
});
