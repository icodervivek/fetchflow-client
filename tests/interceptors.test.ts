import { afterEach, expect, it, vi } from "vitest";
import { createClient } from "../src/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("applies request and response interceptors", async () => {
  const mockFetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: { id: 1 } }), {
      headers: { "Content-Type": "application/json" },
    }),
  );

  vi.stubGlobal("fetch", mockFetch);

  const api = createClient({
    baseURL: "https://example.com",
  });

  api.interceptors.request.use((config) => {
    config.headers.set("X-Test", "enabled");
    return config;
  });

  api.interceptors.response.use((data: unknown) => {
    return (data as { data: unknown }).data;
  });

  await expect(api.get("/users/1")).resolves.toEqual({ id: 1 });

  const requestInit = mockFetch.mock.calls[0][1] as RequestInit;

  expect(new Headers(requestInit.headers).get("X-Test")).toBe("enabled");
});
