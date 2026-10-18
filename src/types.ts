export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface FetchFlowOptions {
  baseURL?: string;
  headers?: HeadersInit;
  timeout?: number;
  retry?: RetryOptions;
}

export interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  params?: QueryParams;
}

export interface FetchFlowErrorOptions {
  status?: number;
  code: string;
  cause?: unknown;
}

export type HttpMethod =
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

export interface RetryOptions {
  /** Maximum retries after the initial request. */
  attempts?: number;

  /** Initial delay between retries, in milliseconds. */
  delay?: number;

  /** Exponential backoff multiplier. */
  backoff?: number;
}


export interface RequestInterceptorConfig {
  url: string;
  method: HttpMethod;
  headers: Headers;
}

export type RequestInterceptor = (
  config: RequestInterceptorConfig
) =>
  | RequestInterceptorConfig
  | Promise<RequestInterceptorConfig>;

export type ResponseInterceptor = (
  data: unknown
) => unknown | Promise<unknown>;

export interface InterceptorManager<T> {
  use(interceptor: T): number;
  eject(id: number): void;
  clear(): void;
}
