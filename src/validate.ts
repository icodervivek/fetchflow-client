import { FetchFlowError } from "./errors.js";
import type { FetchFlowOptions } from "./types.js";

export function validateOptions(options: FetchFlowOptions): void {
  if (options.timeout !== undefined) {
    if (!Number.isFinite(options.timeout) || options.timeout < 0) {
      throw new FetchFlowError(
        "timeout must be a finite, non-negative number.",
        { code: "INVALID_CONFIG" },
      );
    }
  }

  const retry = options.retry;

  if (!retry) return;

  if (retry.attempts !== undefined) {
    if (
      !Number.isInteger(retry.attempts) ||
      retry.attempts < 0 ||
      retry.attempts > 10
    ) {
      throw new FetchFlowError(
        "retry.attempts must be an integer between 0 and 10.",
        { code: "INVALID_CONFIG" },
      );
    }
  }

  if (retry.delay !== undefined) {
    if (!Number.isFinite(retry.delay) || retry.delay < 0) {
      throw new FetchFlowError(
        "retry.delay must be a finite, non-negative number.",
        { code: "INVALID_CONFIG" },
      );
    }
  }

  if (retry.backoff !== undefined) {
    if (!Number.isFinite(retry.backoff) || retry.backoff < 1) {
      throw new FetchFlowError(
        "retry.backoff must be a finite number greater than or equal to 1.",
        { code: "INVALID_CONFIG" },
      );
    }
  }
}
