import { describe, it, expect, vi } from "vitest";
import { dispatch } from "./dispatcher.js";
import { resolveBindings } from "./load.js";

const bindings = resolveBindings({});

describe("dispatch", () => {
  it("fires a matching handler in an allowed context", () => {
    const next = vi.fn();
    const fired = dispatch(bindings, ["list"], { "list.next": next }, "j", {});
    expect(fired).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it("ignores actions whose context is not allowed", () => {
    const next = vi.fn();
    const fired = dispatch(bindings, ["help"], { "list.next": next }, "j", {});
    expect(fired).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns false when no key matches", () => {
    const next = vi.fn();
    const fired = dispatch(bindings, ["list"], { "list.next": next }, "x", {});
    expect(fired).toBe(false);
  });

  it("fires only the first matching action when there are multiple", () => {
    const quit = vi.fn();
    const refresh = vi.fn();
    dispatch(bindings, ["global"], { "global.quit": quit, "global.refresh": refresh }, "r", {});
    expect(quit).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
