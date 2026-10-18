import { FetchFlowError } from "./errors.js";
import type { HttpMethod, RetryOptions } from "./types.js";

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const RETRYABLE_METHODS = new Set<HttpMethod>([
  "GET",
  "HEAD",
  "OPTIONS",
  "PUT",
  "DELETE",
]);

function shouldRetry(error: unknown, method: HttpMethod): boolean {
  if (!RETRYABLE_METHODS.has(method)) {
    return false;
  }

  if (!(error instanceof FetchFlowError)) {
    return false;
  }

  if (error.code === "TIMEOUT" || error.code === "NETWORK_ERROR") {
    return true;
  }

  return (
    error.code === "HTTP_ERROR" &&
    error.status !== undefined &&
    RETRYABLE_STATUSES.has(error.status)
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new FetchFlowError("The request was cancelled.", {
          code: "ABORTED",
          cause: signal.reason,
        }),
      );
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(
        new FetchFlowError("The request was cancelled.", {
          code: "ABORTED",
          cause: signal?.reason,
        }),
      );
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (!(error instanceof FetchFlowError) || !error.retryAfter) {
    return undefined;
  }

  const value = error.retryAfter.trim();

  // Retry-After can be a number of seconds.
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return Math.min(30_000, Number(value) * 1000);
  }

  // Or it can be an HTTP date.
  const date = Date.parse(value);

  if (!Number.isFinite(date)) {
    return undefined;
  }

  return Math.min(30_000, Math.max(0, date - Date.now()));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  method: HttpMethod,
  options: RetryOptions = {},
  signal?: AbortSignal,
): Promise<T> {
  const attempts = Math.max(0, Math.floor(options.attempts ?? 0));

  const baseDelay = Math.max(0, options.delay ?? 300);
  const backoff = Math.max(1, options.backoff ?? 2);

  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) {
      throw new FetchFlowError("The request was cancelled.", {
        code: "ABORTED",
        cause: signal.reason,
      });
    }

    try {
      return await operation();
    } catch (error) {
      if (
        attempt >= attempts ||
        !shouldRetry(error, method) ||
        signal?.aborted
      ) {
        throw error;
      }

      const exponentialDelay = Math.min(30_000, baseDelay * backoff ** attempt);

      const retryAfter = getRetryAfterMs(error);

      const wait = retryAfter ?? exponentialDelay;

      await sleep(wait, signal);
    }
  }
}
