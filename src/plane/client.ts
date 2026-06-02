import { Agent as HttpsAgent } from "node:https";
import { ApiError, AuthError } from "../utils/errors.js";
import { retry } from "../utils/async.js";
import type { ServerConfig } from "../types/config.js";
import { normalizeBaseUrl } from "../utils/urls.js";
import { DEFAULT_TIMEOUT_MS } from "../config/defaults.js";

interface PlaneApiTraceEvent {
  method: string;
  url: string;
  status?: number;
  durationMs: number;
  attempt: number;
  error?: string;
}

export type PlaneApiTrace = (event: PlaneApiTraceEvent) => void;

export interface PlaneApiOptions {
  server: ServerConfig;
  apiKey: string;
  retries?: number;
  fetchImpl?: typeof fetch;
  onTrace?: PlaneApiTrace;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

// Plane returns slightly different shapes across endpoints/versions; we accept either:
//   { results, next_cursor }    (snake_case cursor; some self-hosted releases)
//   { results, next_page_results, total_pages, next_cursor }  (cursor pagination)
//   { results, next, previous }  (DRF default; some workspace endpoints)
// The adapter normalizes via parseCursor().
export interface PaginatedResponse<T> {
  results: T[];
  next_cursor?: string | null;
  next?: string | null;
  next_page_results?: boolean;
  total_pages?: number;
}

// extractNextCursor returns null when there is no further page, regardless of which
// pagination flavor the endpoint speaks. It deliberately trusts boolean flags over
// the bare presence of a cursor — Plane sometimes leaks a non-null cursor on the
// final page, which used to send the client into an infinite pagination loop.
export function extractNextCursor<T>(res: PaginatedResponse<T>): string | null {
  if (res.next_page_results === false) return null;
  if (typeof res.total_pages === "number" && res.total_pages <= 1) return null;
  if (res.next_cursor) return res.next_cursor;
  if (res.next) return res.next;
  return null;
}

// PlaneApiClient encapsulates HTTP access to the Plane API. The official SDK can wrap this
// later; commands and adapters never talk to the SDK directly.
export class PlaneApiClient {
  private readonly baseUrl: string;
  private readonly workspaceSlug: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly httpsAgent?: HttpsAgent;
  private readonly onTrace?: PlaneApiTrace;

  constructor(opts: PlaneApiOptions) {
    if (!opts.apiKey) throw new AuthError("api key is required");
    this.baseUrl = `${normalizeBaseUrl(opts.server.base_url)}/api/v1`;
    this.workspaceSlug = opts.server.workspace_slug;
    this.timeoutMs = opts.server.timeout_ms ?? DEFAULT_TIMEOUT_MS;
    this.retries = opts.retries ?? 2;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.onTrace = opts.onTrace;
    this.headers = {
      "x-api-key": opts.apiKey,
      accept: "application/json",
      "content-type": "application/json",
      ...(opts.server.headers ?? {}),
    };
    if (opts.server.tls?.reject_unauthorized === false) {
      this.httpsAgent = new HttpsAgent({ rejectUnauthorized: false });
    }
  }

  get workspace(): string {
    return this.workspaceSlug;
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    // Plane's API (Django APPEND_SLASH) 301-redirects any path without a trailing
    // slash. Request the slashed form directly to avoid a redirect round-trip per
    // call (which also risks dropped auth headers and timeouts). The URL parser
    // keeps the slash before the query string.
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const method = opts.method ?? "GET";
    let attempt = 0;
    return retry(
      // The per-attempt flow (abort wiring, timeout, trace, status classification)
      // is cohesive; splitting it would scatter the request lifecycle and hurt
      // readability, so the complexity cap is waived here.
      // eslint-disable-next-line complexity
      async () => {
        attempt += 1;
        // Per-attempt AbortController so the timeout resets on each retry and a
        // slow first try does not poison the budget of the second.
        const attemptController = new AbortController();
        const onParentAbort = (): void => {
          attemptController.abort(opts.signal?.reason ?? new Error("aborted"));
        };
        opts.signal?.addEventListener("abort", onParentAbort, { once: true });
        const timeoutHandle = setTimeout(
          () => attemptController.abort(new Error("timeout")),
          this.timeoutMs,
        );
        const init: RequestInit & { dispatcher?: unknown; agent?: unknown } = {
          method,
          headers: this.headers,
          signal: attemptController.signal,
        };
        if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
        if (this.httpsAgent) init.agent = this.httpsAgent;
        const started = Date.now();
        try {
          let res: Response;
          try {
            res = await this.fetchImpl(url, init);
          } catch (err) {
            const aborted =
              attemptController.signal.aborted && (err as Error).message?.includes("abort");
            this.onTrace?.({
              method,
              url,
              attempt,
              durationMs: Date.now() - started,
              error: aborted ? "timeout" : describeNetworkError(err),
            });
            if (aborted)
              throw new ApiError(`timeout after ${this.timeoutMs}ms: ${url}`, undefined, {
                url,
                cause: describeNetworkError(err),
              });
            // `fetch failed` is opaque; surface the underlying cause (ENOTFOUND,
            // ECONNREFUSED, CERT_*, …) plus the target URL so the operator can
            // tell a wrong base_url / unreachable host / TLS problem apart.
            throw new ApiError(
              `cannot reach Plane: ${describeNetworkError(err)} (${url})`,
              undefined,
              { url, cause: (err as Error).message },
            );
          }
          const durationMs = Date.now() - started;
          this.onTrace?.({ method, url, status: res.status, attempt, durationMs });
          if (res.status === 401 || res.status === 403) {
            throw new AuthError(
              `Plane rejected the API key (HTTP ${res.status}) — re-run \`plc auth login\` or check the key has access to this workspace`,
              { url, status: res.status },
            );
          }
          if (res.status === 404) {
            throw new ApiError(`not found: ${url}`, 404);
          }
          if (!res.ok) {
            const text = await safeText(res);
            throw new ApiError(`request failed: ${res.status}`, res.status, { url, body: text });
          }
          if (res.status === 204) return undefined as T;
          return (await res.json()) as T;
        } finally {
          clearTimeout(timeoutHandle);
          opts.signal?.removeEventListener("abort", onParentAbort);
        }
      },
      {
        retries: this.retries,
        baseDelayMs: 200,
        shouldRetry: (err) => {
          if (err instanceof AuthError) return false;
          if (err instanceof ApiError) {
            const status = err.status ?? 0;
            return status >= 500 || status === 429;
          }
          // Network-level errors (DNS, ECONNRESET) are worth a retry; timeouts
          // are not — they likely repeat and just add latency to the failure.
          const msg = (err as Error).message ?? "";
          if (msg.includes("timeout")) return false;
          return true;
        },
        signal: opts.signal,
      },
    );
  }

  workspacePath(...segments: string[]): string {
    // Encode each segment so an id containing "/", "?", "#" or "." cannot alter
    // the URL structure (path traversal / parameter injection). The workspace
    // slug comes from config; ids come from the API or validated CLI input, but
    // encoding here is defense in depth regardless of source.
    const parts = [this.workspaceSlug, ...segments].map((s) => encodeURIComponent(s));
    return `/workspaces/${parts.join("/")}`;
  }
}

// Maps the OS/TLS error codes undici surfaces on `err.cause.code` to an operator
// hint. `%s` is replaced with the raw code so the hint stays greppable.
const NETWORK_ERROR_HINTS: Record<string, string> = {
  ENOTFOUND: "DNS lookup failed (%s) — check server.base_url",
  EAI_AGAIN: "DNS lookup failed (%s) — check server.base_url",
  ECONNREFUSED: "connection refused (%s) — server unreachable or wrong port",
  ECONNRESET: "connection reset (%s)",
  ETIMEDOUT: "connection timed out (%s)",
  DEPTH_ZERO_SELF_SIGNED_CERT:
    "TLS certificate error (%s) — set server.tls.reject_unauthorized: false for self-signed hosts",
  SELF_SIGNED_CERT_IN_CHAIN:
    "TLS certificate error (%s) — set server.tls.reject_unauthorized: false for self-signed hosts",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    "TLS certificate error (%s) — set server.tls.reject_unauthorized: false for self-signed hosts",
  CERT_HAS_EXPIRED:
    "TLS certificate error (%s) — set server.tls.reject_unauthorized: false for self-signed hosts",
};

// describeNetworkError turns Node's opaque "fetch failed" TypeError into a
// human-readable cause. The real failure lives on `err.cause.code`; we map the
// common ones to an operator hint and fall back to the raw code/message.
function describeNetworkError(err: unknown): string {
  const cause = (err as { cause?: { code?: string; message?: string } }).cause;
  const code = cause?.code;
  if (code && NETWORK_ERROR_HINTS[code]) return NETWORK_ERROR_HINTS[code].replace("%s", code);
  if (code) return code;
  return cause?.message ?? (err as Error).message ?? "unknown network error";
}

async function safeText(res: Response): Promise<string | undefined> {
  try {
    return await res.text();
  } catch {
    return undefined;
  }
}
