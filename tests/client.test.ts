
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../src/client.js";
import { FetchFlowError } from "../src/errors.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FetchFlow client", () => {
  it("returns parsed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const api = createClient({ baseURL: "https://example.com" });

    await expect(api.get<{ id: number }>("/users/1"))
      .resolves.toEqual({ id: 1 });
  });

  it("adds query parameters", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
      })
    );

    vi.stubGlobal("fetch", mockFetch);

    const api = createClient({ baseURL: "https://example.com" });

    await api.get("/users", {
      params: { page: 2, active: true },
    });

    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://example.com/users?page=2&active=true"
    );
  });

  it("throws a standardized HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: "User not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const api = createClient({ baseURL: "https://example.com" });

    await expect(api.get("/users/999"))
      .rejects.toMatchObject({
        name: "FetchFlowError",
        status: 404,
        code: "HTTP_ERROR",
        message: "User not found",
      });
  });

  it("throws TIMEOUT when a request exceeds its timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("Aborted")),
            { once: true }
          );
        })
      )
    );

    const api = createClient({
      baseURL: "https://example.com",
      timeout: 20,
    });

    try {
      await api.get("/slow");
      throw new Error("Expected request to time out");
    } catch (error) {
      expect(error).toBeInstanceOf(FetchFlowError);
      expect(error).toMatchObject({ code: "TIMEOUT" });
    }
  });
});
