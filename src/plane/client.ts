import { Agent as HttpsAgent } from "node:https";
import { ApiError, AuthError } from "../utils/errors.js";
import { retry } from "../utils/async.js";
import type { ServerConfig } from "../types/config.js";
import { normalizeBaseUrl } from "../utils/urls.js";
import { DEFAULT_TIMEOUT_MS } from "../config/defaults.js";

export interface PlaneApiOptions {
  server: ServerConfig;
  apiKey: string;
  retries?: number;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface PaginatedResponse<T> {
  results: T[];
  next_cursor: string | null;
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

  constructor(opts: PlaneApiOptions) {
    if (!opts.apiKey) throw new AuthError("api key is required");
    this.baseUrl = `${normalizeBaseUrl(opts.server.base_url)}/api/v1`;
    this.workspaceSlug = opts.server.workspace_slug;
    this.timeoutMs = opts.server.timeout_ms ?? DEFAULT_TIMEOUT_MS;
    this.retries = opts.retries ?? 2;
    this.fetchImpl = opts.fetchImpl ?? fetch;
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
    const controller = new AbortController();
    if (opts.signal) {
      opts.signal.addEventListener("abort", () => controller.abort(opts.signal?.reason), {
        once: true,
      });
    }
    const timeout = setTimeout(() => controller.abort(new Error("timeout")), this.timeoutMs);
    try {
      return await retry(
        async () => {
          const init: RequestInit & { dispatcher?: unknown; agent?: unknown } = {
            method: opts.method ?? "GET",
            headers: this.headers,
            signal: controller.signal,
          };
          if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
          if (this.httpsAgent) init.agent = this.httpsAgent;
          const res = await this.fetchImpl(url, init);
          if (res.status === 401 || res.status === 403) {
            throw new AuthError(`unauthorized: ${res.status}`, { url });
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
            return true;
          },
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  workspacePath(...segments: string[]): string {
    return `/workspaces/${this.workspaceSlug}/${segments.join("/")}`;
  }
}

async function safeText(res: Response): Promise<string | undefined> {
  try {
    return await res.text();
  } catch {
    return undefined;
  }
}
