import { describe, it, expect, vi } from "vitest";
import { collectPages, retry, sleep, mapWithConcurrency } from "./async.js";

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

  it("stops when a page returns no items (defensive against leaky cursors)", async () => {
    let calls = 0;
    const items = await collectPages<number>({
      fetchPage: async () => {
        calls++;
        if (calls === 1) return { items: [1, 2], nextCursor: "a" };
        return { items: [], nextCursor: "b" };
      },
    });
    expect(items).toEqual([1, 2]);
    expect(calls).toBe(2);
  });

  it("caps at maxPages to avoid infinite loops", async () => {
    let calls = 0;
    const items = await collectPages<number>(
      {
        fetchPage: async () => {
          calls++;
          return { items: [calls], nextCursor: "still-going" };
        },
      },
      { maxPages: 3 },
    );
    expect(items).toEqual([1, 2, 3]);
    expect(calls).toBe(3);
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

  it("rejects when the signal aborts mid-sleep", async () => {
    const ctrl = new AbortController();
    const promise = sleep(500, ctrl.signal);
    setTimeout(() => ctrl.abort(new Error("late")), 10);
    await expect(promise).rejects.toThrow("late");
  });
});

describe("mapWithConcurrency", () => {
  // Results keep input order even though items finish out of order.
  it("preserves result order regardless of completion order", async () => {
    const delays = [30, 5, 20, 1];
    const results = await mapWithConcurrency(delays, 2, async (ms, i) => {
      await sleep(ms);
      return i;
    });
    expect(results).toEqual([0, 1, 2, 3]);
  });

  // Never more than `concurrency` workers run at once; the peak is observed.
  it("caps the number of in-flight workers", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight--;
    });
    expect(peak).toBe(3);
  });

  // A concurrency wider than the item count just runs them all in parallel.
  it("clamps concurrency to the number of items", async () => {
    let peak = 0;
    let inFlight = 0;
    await mapWithConcurrency([1, 2], 10, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight--;
    });
    expect(peak).toBe(2);
  });

  // An empty input does no work and returns an empty array.
  it("returns an empty array for no items", async () => {
    const worker = vi.fn();
    expect(await mapWithConcurrency([], 3, worker)).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });
});
