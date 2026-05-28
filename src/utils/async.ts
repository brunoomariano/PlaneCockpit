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

export interface CollectPagesOptions {
  limit?: number;
  maxPages?: number;
}

// collectPages walks paginated responses until one of:
//   - limit is reached (results are trimmed);
//   - nextCursor is null/absent;
//   - the page came back empty (defensive against APIs that keep returning a cursor);
//   - maxPages is reached (defensive against accidental infinite pagination).
export async function collectPages<T>(
  paginator: Paginator<T>,
  options?: number | CollectPagesOptions,
): Promise<T[]> {
  const limit = typeof options === "number" ? options : options?.limit;
  const maxPages = (typeof options === "object" ? options?.maxPages : undefined) ?? 50;
  const out: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const { items, nextCursor } = await paginator.fetchPage(cursor);
    out.push(...items);
    if (limit !== undefined && out.length >= limit) return out.slice(0, limit);
    if (!nextCursor) return out;
    if (items.length === 0) return out;
    cursor = nextCursor;
  }
  return out;
}
