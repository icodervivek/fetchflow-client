import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../src/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FetchFlow retry engine", () => {
  it("retries a GET after a temporary server error", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("Unavailable", {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", mockFetch);

    const api = createClient({
      baseURL: "https://example.com",
      retry: { attempts: 1, delay: 0 },
    });

    await expect(api.get("/health")).resolves.toEqual({
      ok: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("Not found", { status: 404 }));

    vi.stubGlobal("fetch", mockFetch);

    const api = createClient({
      baseURL: "https://example.com",
      retry: { attempts: 3, delay: 0 },
    });

    await expect(api.get("/missing")).rejects.toMatchObject({
      status: 404,
      code: "HTTP_ERROR",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry POST requests by default", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("Unavailable", { status: 503 }));

    vi.stubGlobal("fetch", mockFetch);

    const api = createClient({
      baseURL: "https://example.com",
      retry: { attempts: 3, delay: 0 },
    });

    await expect(api.post("/orders", { item: "book" })).rejects.toMatchObject({
      status: 503,
      code: "HTTP_ERROR",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("stops after the configured retry limit", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("Unavailable", { status: 503 }));

    vi.stubGlobal("fetch", mockFetch);

    const api = createClient({
      baseURL: "https://example.com",
      retry: { attempts: 2, delay: 0 },
    });

    await expect(api.get("/health")).rejects.toMatchObject({
      status: 503,
    });

    // One initial request + two retries.
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});


it("retries a GET when the server provides Retry-After", async () => {
  vi.useFakeTimers();

  try {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response("Rate limited", {
          status: 429,
          headers: { "Retry-After": "1" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        })
      );

    vi.stubGlobal("fetch", mockFetch);

    const api = createClient({
      baseURL: "https://example.com",
      retry: { attempts: 1, delay: 0 },
    });

    const resultPromise = api.get("/health");

    await vi.advanceTimersByTimeAsync(999);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toEqual({ ok: true });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
