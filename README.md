
# FetchFlow

A lightweight, TypeScript-first HTTP client built on the native Fetch API.

FetchFlow provides a consistent API for HTTP requests, standardized errors,
timeouts, retries, and request/response interceptors.

## Features

- TypeScript-friendly HTTP methods
- Configurable base URL and headers
- JSON request and response handling
- Query parameter support
- Request timeouts and cancellation
- Configurable retry policies
- Request and response interceptors
- Standardized error handling
- ESM and CommonJS builds

## Installation

```bash
npm install fetchflow
```

## Quick Start

```typescript
import { createClient } from "fetchflow";

const api = createClient({
  baseURL: "https://jsonplaceholder.typicode.com",
  timeout: 5000,
});

interface User {
  id: number;
  name: string;
  email: string;
}

const users = await api.get<User[]>("/users");

console.log(users);
```

## Configuration

```typescript
const api = createClient({
  baseURL: "https://api.example.com",
  timeout: 5000,
  retry: {
    attempts: 2,
    delay: 500,
    backoff: 2,
  },
});
```

Retry attempts are additional attempts after the initial request.
Only configured, eligible requests are retried.

## HTTP Methods

```typescript
await api.get("/users");

await api.post("/users", {
  name: "Vivek",
});

await api.put("/users/1", {
  name: "Updated User",
});

await api.patch("/users/1", {
  name: "New Name",
});

await api.delete("/users/1");
```

## Query Parameters

```typescript
const users = await api.get("/users", {
  params: {
    page: 1,
    limit: 10,
    active: true,
  },
});
```

## Request Interceptors

```typescript
const interceptorId = api.interceptors.request.use((config) => {
  config.headers.set("X-App-Name", "MyApplication");
  return config;
});

// Remove an interceptor when it is no longer needed.
api.interceptors.request.eject(interceptorId);
```

## Response Interceptors

```typescript
api.interceptors.response.use((data) => {
  console.log("Response received");
  return data;
});
```

## Error Handling

```typescript
import { FetchFlowError } from "fetchflow";

try {
  const users = await api.get("/users");
} catch (error) {
  if (error instanceof FetchFlowError) {
    console.error(error.code);
    console.error(error.status);
    console.error(error.message);
  }
}
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT
