import { FetchFlowError } from "./errors.js";
import type {
  FetchFlowOptions,
  HttpMethod,
  QueryParams,
  RequestOptions,
  InterceptorManager,
  RequestInterceptor,
  ResponseInterceptor,
} from "./types.js";
import { validateOptions } from "./validate.js";
import { withRetry } from "./retry.js";

function buildURL(
  path: string,
  baseURL?: string,
  params?: QueryParams,
): string {
  let url: URL;

  try {
    url = baseURL
      ? new URL(path, baseURL.endsWith("/") ? baseURL : `${baseURL}/`)
      : new URL(path);
  } catch (cause) {
    throw new FetchFlowError(
      "Invalid URL. Provide an absolute URL or configure baseURL.",
      { code: "INVALID_URL", cause },
    );
  }

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("json")) {
    try {
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new FetchFlowError("The server returned invalid JSON.", {
        status: response.status,
        code: "INVALID_RESPONSE",
        cause,
      });
    }
  }

  return text as T;
}

export function createClient(options: FetchFlowOptions = {}) {
  validateOptions(options);
  const defaultHeaders = new Headers(options.headers);

  const requestInterceptors = new Map<number, RequestInterceptor>();
  const responseInterceptors = new Map<number, ResponseInterceptor>();

  let nextInterceptorId = 0;

  function createInterceptorManager<T>(
    registry: Map<number, T>,
  ): InterceptorManager<T> {
    return {
      use(interceptor) {
        const id = nextInterceptorId++;
        registry.set(id, interceptor);
        return id;
      },

      eject(id) {
        registry.delete(id);
      },

      clear() {
        registry.clear();
      },
    };
  }

  const requestInterceptorManager =
    createInterceptorManager(requestInterceptors);

  const responseInterceptorManager =
    createInterceptorManager(responseInterceptors);

  async function requestOnce<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const { params, headers: requestHeaders, ...init } = requestOptions;

    let headers = new Headers(defaultHeaders);
    new Headers(requestHeaders).forEach((value, key) => {
      headers.set(key, value);
    });

    let requestBody: BodyInit | undefined;

    if (body !== undefined) {
      if (
        typeof body === "string" ||
        body instanceof Blob ||
        body instanceof FormData ||
        body instanceof URLSearchParams ||
        body instanceof ArrayBuffer ||
        ArrayBuffer.isView(body)
      ) {
        requestBody = body as BodyInit;
      } else {
        requestBody = JSON.stringify(body);

        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      }
    }

    let url: string;

    try {
      url = buildURL(path, options.baseURL, params);
    } catch (error) {
      throw error;
    }

    let requestConfig = {
      url,
      method,
      headers,
    };

    for (const interceptor of requestInterceptors.values()) {
      requestConfig = await interceptor(requestConfig);
    }

    url = requestConfig.url;
    method = requestConfig.method;
    headers = new Headers(requestConfig.headers);

    const controller = new AbortController();
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const callerSignal = init.signal;

    const abortFromCaller = () => {
      controller.abort(callerSignal?.reason);
    };

    if (callerSignal?.aborted) {
      abortFromCaller();
    } else {
      callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    if (options.timeout !== undefined && options.timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeout);
    }

    try {
      const response = await fetch(url, {
        ...init,
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;

        try {
          const errorBody = await response.clone().json();

          if (typeof errorBody.message === "string") {
            message = errorBody.message;
          }
        } catch {
          // Preserve the default message for non-JSON error bodies.
        }

        throw new FetchFlowError(message, {
          status: response.status,
          code: "HTTP_ERROR",
          retryAfter: response.headers.get("Retry-After") ?? undefined,
        });
      }

      let data: unknown = await parseResponse<T>(response);

      for (const interceptor of responseInterceptors.values()) {
        data = await interceptor(data);
      }

      return data as T;
    } catch (cause) {
      if (cause instanceof FetchFlowError) {
        throw cause;
      }

      if (timedOut) {
        throw new FetchFlowError("The request timed out.", {
          code: "TIMEOUT",
          cause,
        });
      }

      if (callerSignal?.aborted) {
        throw new FetchFlowError("The request was cancelled.", {
          code: "ABORTED",
          cause,
        });
      }

      throw new FetchFlowError(
        "The request failed before a response was received.",
        {
          code: "NETWORK_ERROR",
          cause,
        },
      );
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  async function request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    return withRetry(
      () => requestOnce<T>(method, path, body, requestOptions),
      method,
      options.retry,
      requestOptions.signal ?? undefined,
    );
  }

  return {
    interceptors: {
      request: requestInterceptorManager,
      response: responseInterceptorManager,
    },

    request,

    get<T>(path: string, opts?: RequestOptions) {
      return request<T>("GET", path, undefined, opts);
    },

    post<T>(path: string, body?: unknown, opts?: RequestOptions) {
      return request<T>("POST", path, body, opts);
    },

    put<T>(path: string, body?: unknown, opts?: RequestOptions) {
      return request<T>("PUT", path, body, opts);
    },

    patch<T>(path: string, body?: unknown, opts?: RequestOptions) {
      return request<T>("PATCH", path, body, opts);
    },

    delete<T>(path: string, opts?: RequestOptions) {
      return request<T>("DELETE", path, undefined, opts);
    },
  };
}
