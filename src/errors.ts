export class FetchFlowError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly cause?: unknown;
  readonly retryAfter?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      code: string;
      cause?: unknown;
      retryAfter?: string;
    }
  ) {
    super(message);

    this.name = "FetchFlowError";
    this.status = options.status;
    this.code = options.code;
    this.cause = options.cause;
    this.retryAfter = options.retryAfter;
  }
}