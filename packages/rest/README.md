# @workflow-stack/rest

REST/HTTP plugin for @workflow-stack/core - HTTP service orchestration using Undici.

## Installation

```bash
npm install @workflow-stack/core @workflow-stack/rest undici
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

### Global Interceptors

Cross-cutting concerns (authentication, retries, logging, etc.) should be applied at the undici global dispatcher level in your application, not per-service. The rest plugin composes any service-level interceptors (e.g. `cacheStore`) on top of the current global dispatcher, so global interceptors are always preserved.

```javascript
import { Agent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new Agent().compose(myInterceptor));
```

All REST services will then pick up the interceptor automatically without any per-service configuration.

### HTTP Response Caching with `cacheStore`

The `cacheStore` option enables per-service HTTP response caching via undici's built-in [cache interceptor](https://undici.nodejs.org/#/docs/api/CacheStore). When provided, responses with appropriate `Cache-Control` headers are stored and served from the cache on subsequent requests.

Any object implementing undici's `CacheStore` interface can be used.

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
```

#### Sharing a Cache Store Across Services

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
