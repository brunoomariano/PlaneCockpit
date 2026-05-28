export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  factor?: number;
  shouldRetry?: (err: unknown) => boolean;
  signal?: AbortSignal;
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const baseDelay = opts.baseDelayMs ?? 200;
  const factor = opts.factor ?? 2;
  const shouldRetry = opts.shouldRetry ?? (() => true);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    if (opts.signal?.aborted) throw opts.signal.reason ?? new Error("aborted");
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === opts.retries || !shouldRetry(err)) throw err;
      const delay = baseDelay * Math.pow(factor, attempt);
      await sleep(delay, opts.signal);
    }
  }
  throw lastErr;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface Paginator<T> {
  fetchPage(cursor: string | null): Promise<{ items: T[]; nextCursor: string | null }>;
}

export async function collectPages<T>(
  paginator: Paginator<T>,
  limit?: number,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  while (true) {
    const { items, nextCursor } = await paginator.fetchPage(cursor);
    out.push(...items);
    if (limit !== undefined && out.length >= limit) return out.slice(0, limit);
    if (!nextCursor) return out;
    cursor = nextCursor;
  }
}
