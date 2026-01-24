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
