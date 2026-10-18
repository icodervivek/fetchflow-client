
import { describe, expect, it } from "vitest";
import { createClient } from "../src/client.js";
import { FetchFlowError } from "../src/errors.js";

describe("FetchFlow configuration", () => {
  it("accepts valid configuration", () => {
    expect(() =>
      createClient({
        baseURL: "https://example.com",
        timeout: 5000,
        retry: {
          attempts: 3,
          delay: 500,
          backoff: 2,
        },
      })
    ).not.toThrow();
  });

  it("rejects a negative timeout", () => {
    expect(() => createClient({ timeout: -1 }))
      .toThrow(FetchFlowError);
  });

  it("rejects a fractional retry count", () => {
    expect(() =>
      createClient({ retry: { attempts: 1.5 } })
    ).toThrow(FetchFlowError);
  });

  it("rejects more than 10 retries", () => {
    expect(() =>
      createClient({ retry: { attempts: 11 } })
    ).toThrow(FetchFlowError);
  });

  it("rejects a backoff multiplier below 1", () => {
    expect(() =>
      createClient({ retry: { backoff: 0.5 } })
    ).toThrow(FetchFlowError);
  });
});
