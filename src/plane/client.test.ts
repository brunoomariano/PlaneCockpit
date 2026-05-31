import { describe, it, expect } from "vitest";
import { PlaneApiClient, extractNextCursor, type PaginatedResponse } from "./client.js";
import { ApiError } from "../utils/errors.js";

function page(extra: Partial<PaginatedResponse<unknown>>): PaginatedResponse<unknown> {
  return { results: [], ...extra };
}

function client(fetchImpl?: typeof fetch): PlaneApiClient {
  return new PlaneApiClient({
    server: { base_url: "https://plane.example.com", workspace_slug: "acme" },
    apiKey: "k",
    retries: 0,
    fetchImpl,
  });
}

// Build a Node-style fetch TypeError whose underlying cause exposes a `.code`,
// mirroring how undici surfaces DNS/connection/TLS failures.
function networkError(code: string): TypeError {
  const err = new TypeError("fetch failed");
  (err as { cause?: unknown }).cause = { code };
  return err;
}

describe("workspacePath", () => {
  it("builds a workspace-scoped path from segments", () => {
    expect(client().workspacePath("projects", "p1", "issues")).toBe(
      "/workspaces/acme/projects/p1/issues",
    );
  });

  it("encodes segments so they cannot alter the URL structure", () => {
    // A segment trying to traverse or inject query/fragment is neutralized.
    expect(client().workspacePath("projects", "../../admin")).toBe(
      "/workspaces/acme/projects/..%2F..%2Fadmin",
    );
    expect(client().workspacePath("issues", "x?y#z")).toBe("/workspaces/acme/issues/x%3Fy%23z");
  });
});

describe("extractNextCursor", () => {
  it("returns null when no pagination metadata is present", () => {
    expect(extractNextCursor(page({}))).toBeNull();
  });

  it("prefers the explicit next_page_results=false signal", () => {
    expect(
      extractNextCursor(page({ next_cursor: "still-here", next_page_results: false })),
    ).toBeNull();
  });

  it("returns null when total_pages is 1 even if a cursor leaks through", () => {
    expect(extractNextCursor(page({ next_cursor: "leak", total_pages: 1 }))).toBeNull();
  });

  it("returns next_cursor when set", () => {
    expect(extractNextCursor(page({ next_cursor: "abc" }))).toBe("abc");
  });

  it("falls back to next when next_cursor is missing", () => {
    expect(extractNextCursor(page({ next: "abc" }))).toBe("abc");
  });
});

describe("request error reporting", () => {
  // A 401/403 must name the API key as the culprit and point at `plc auth login`,
  // rather than the opaque "unauthorized: 401" it used to throw.
  it("maps 401 to an AuthError that blames the API key", async () => {
    const fetchImpl = (async () => new Response("", { status: 401 })) as unknown as typeof fetch;
    await expect(client(fetchImpl).request("/users/me")).rejects.toMatchObject({
      code: "AUTH",
      message: expect.stringContaining("API key"),
    });
  });

  // The bare "fetch failed" TypeError from Node must be translated into the
  // underlying cause plus the target URL so a wrong base_url is diagnosable.
  it("translates a DNS failure into a reachable cause and url", async () => {
    const fetchImpl = (async () => {
      throw networkError("ENOTFOUND");
    }) as unknown as typeof fetch;
    const err = await client(fetchImpl)
      .request("/users/me")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toContain("DNS lookup failed");
    expect((err as ApiError).message).toContain("base_url");
    expect((err as ApiError).message).toContain("plane.example.com");
  });

  it("hints at TLS config for self-signed certificate errors", async () => {
    const fetchImpl = (async () => {
      throw networkError("DEPTH_ZERO_SELF_SIGNED_CERT");
    }) as unknown as typeof fetch;
    await expect(client(fetchImpl).request("/users/me")).rejects.toThrow(/reject_unauthorized/);
  });

  it("falls back to the raw code for unmapped network errors", async () => {
    const fetchImpl = (async () => {
      throw networkError("EHOSTUNREACH");
    }) as unknown as typeof fetch;
    await expect(client(fetchImpl).request("/users/me")).rejects.toThrow(/EHOSTUNREACH/);
  });
});
