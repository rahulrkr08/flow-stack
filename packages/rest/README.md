# @workflow-stack/rest

REST/HTTP plugin for @workflow-stack/core - HTTP service orchestration using Undici.

## Installation

```bash
npm install @workflow-stack/core @workflow-stack/rest
```

## Quick Start

```javascript
import { runOrchestration, registerPlugin } from '@workflow-stack/core';
import { restPlugin } from '@workflow-stack/rest';

// Register the REST plugin
registerPlugin(restPlugin);

const services = [
  {
    id: 'fetchUser',
    service: {
      type: 'rest',
      url: 'https://api.example.com/users/1',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer {env.API_TOKEN}'
      }
    }
  }
];

const result = await runOrchestration(services, {
  env: { API_TOKEN: 'your-token' }
});
```

## REST Service Configuration

```typescript
interface RestServiceConfig {
  type: 'rest';
  url: string;
  method: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  timeout?: number;
  cacheStore?: CacheStore;
  oidc?: {
    clientId: string;
    clientSecret: string;
    scope?: string;
    tokenUrl?: string;
  };
  fallback?: {
    status?: number | null;
    data: any;
  };
  errorStrategy?: 'silent' | 'throw';
}
```

## Examples

### GET Request with Query Parameters

```javascript
{
  id: 'searchUsers',
  service: {
    type: 'rest',
    url: 'https://api.example.com/users',
    method: 'GET',
    query: {
      search: '{request.query.term}',
      limit: '10'
    },
    headers: {
      'Authorization': 'Bearer {env.API_TOKEN}'
    }
  }
}
```

### POST Request with JSON Body

```javascript
{
  id: 'createUser',
  service: {
    type: 'rest',
    url: 'https://api.example.com/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: {
      name: '{request.body.name}',
      email: '{request.body.email}'
    }
  }
}
```

### Using Dependencies

```javascript
const services = [
  {
    id: 'auth',
    service: {
      type: 'rest',
      url: 'https://api.example.com/login',
      method: 'POST',
      body: { username: 'admin', password: '{env.PASSWORD}' }
    }
  },
  {
    id: 'getData',
    dependsOn: ['auth'],
    service: {
      type: 'rest',
      url: 'https://api.example.com/data',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer {auth.body.token}'
      }
    }
  }
];
```

### With Fallback

```javascript
{
  id: 'fetchData',
  service: {
    type: 'rest',
    url: 'https://api.example.com/data',
    method: 'GET',
    timeout: 5000,
    fallback: {
      status: 200,
      data: { cached: true, items: [] }
    }
  }
}
```

### OIDC Authentication

```javascript
{
  id: 'secureApi',
  service: {
    type: 'rest',
    url: 'https://api.example.com/protected',
    method: 'GET',
    oidc: {
      clientId: '{env.OIDC_CLIENT_ID}',
      clientSecret: '{env.OIDC_CLIENT_SECRET}',
      scope: 'openid profile',
      tokenUrl: 'https://auth.example.com/oauth/token'
    }
  }
}
```

### HTTP Response Caching with `cacheStore`

The `cacheStore` option enables HTTP response caching via undici's built-in [cache interceptor](https://undici.nodejs.org/#/docs/api/CacheStore). When provided, responses with appropriate `Cache-Control` headers are stored and served from the cache on subsequent requests, avoiding redundant network calls.

Any object implementing undici's `CacheStore` interface can be used:

- **`MemoryCacheStore`** (from `undici`) — in-memory cache, useful for testing and short-lived processes.
- **`RedisCacheStore`** (from `undici-cache-redis`) — Redis-backed cache for production use across multiple instances.

#### In-Memory Cache (Testing / Development)

```javascript
import undici from 'undici';

const store = new undici.cacheStores.MemoryCacheStore();

const services = [
  {
    id: 'fetchUser',
    service: {
      type: 'rest',
      url: 'https://api.example.com/users/1',
      method: 'GET',
      cacheStore: store,
    }
  }
];

const result = await runOrchestration(services, {});
// Subsequent calls with the same config will be served from cache
// if the response includes a Cache-Control header (e.g. max-age=300)
```

#### Redis Cache (Production)

```bash
npm install undici-cache-redis
```

```javascript
import { RedisCacheStore } from 'undici-cache-redis';

const store = new RedisCacheStore({
  clientOpts: { host: 'localhost', port: 6379 }
});

const services = [
  {
    id: 'fetchUser',
    service: {
      type: 'rest',
      url: 'https://api.example.com/users/1',
      method: 'GET',
      cacheStore: store,
    }
  }
];
```

#### Sharing a Cache Store Across Services

You can share a single store instance across multiple services so they benefit from the same cache:

```javascript
import undici from 'undici';

const sharedCache = new undici.cacheStores.MemoryCacheStore();

const services = [
  {
    id: 'fetchUser',
    service: {
      type: 'rest',
      url: 'https://api.example.com/users/1',
      method: 'GET',
      cacheStore: sharedCache,
    }
  },
  {
    id: 'fetchProfile',
    service: {
      type: 'rest',
      url: 'https://api.example.com/users/1/profile',
      method: 'GET',
      cacheStore: sharedCache,
    }
  }
];
```

> **Note:** Caching only applies when the server's response includes cache-friendly headers (e.g. `Cache-Control: max-age=300`). Responses without caching headers will not be stored.

## Response Handling

The plugin automatically handles different content types:

- **JSON**: Parsed to objects
- **Binary** (images, PDFs, etc.): Returned as Buffer
- **Text**: Returned as string

Response structure:

```typescript
{
  status: number;
  body: any;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  metadata: {
    executionStatus: 'executed' | 'failed';
    serviceType: 'rest';
    fallbackUsed?: boolean;
  };
  error?: {
    message: string;
    code?: string;
  };
}
```

## TypeScript Support

```typescript
import type { RestServiceConfig } from '@workflow-stack/rest';
import { restPlugin, executeRestService } from '@workflow-stack/rest';
```

## License

MIT
