import { describe, it, expect, vi } from "vitest";
import { collectPages, retry, sleep } from "./async.js";

describe("retry", () => {
  it("returns the first successful result", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(retry(fn, { retries: 2 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to the configured count", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error("fail");
      return "ok";
    });
    await expect(retry(fn, { retries: 3, baseDelayMs: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops retrying when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    await expect(
      retry(fn, { retries: 5, baseDelayMs: 1, shouldRetry: () => false }),
    ).rejects.toThrow("nope");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("aborts when the signal is triggered", async () => {
    const controller = new AbortController();
    controller.abort(new Error("user"));
    await expect(
      retry(async () => "x", { retries: 0, signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe("collectPages", () => {
  it("walks pages until next cursor is null", async () => {
    const pages = [
      { items: [1, 2], nextCursor: "a" },
      { items: [3, 4], nextCursor: "b" },
      { items: [5], nextCursor: null },
    ];
    let idx = 0;
    const items = await collectPages<number>({
      fetchPage: async () => pages[idx++]!,
    });
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it("respects the limit and short-circuits", async () => {
    const items = await collectPages<number>(
      {
        fetchPage: async () => ({ items: [1, 2, 3], nextCursor: "a" }),
      },
      2,
    );
    expect(items).toEqual([1, 2]);
  });
});

describe("sleep", () => {
  it("resolves after the timeout", async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it("rejects immediately when signal is already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort(new Error("x"));
    await expect(sleep(100, ctrl.signal)).rejects.toThrow();
  });
});
