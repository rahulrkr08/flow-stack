import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import undici, { Agent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import type { Dispatcher } from 'undici';
import { executeRestService } from '../src/rest-executor.js';
import { MockServer } from './helpers.js';

const { cacheStores } = undici;

describe('Cache Store Integration', () => {
  let originalDispatcher: Dispatcher | undefined;

  afterEach(() => {
    if (originalDispatcher) {
      setGlobalDispatcher(originalDispatcher);
      originalDispatcher = undefined;
    }
  });
  it('should accept a cacheStore on RestServiceConfig and make a successful request', async () => {
    const store = new cacheStores.MemoryCacheStore();
    const server = new MockServer((_req: any, res: any) => {
      res.writeHead(200, {
        'content-type': 'application/json',
        'cache-control': 'max-age=300',
      });
      res.end(JSON.stringify({ id: 1, name: 'cached-user' }));
    });
    await server.listen();

    try {
      const result = await executeRestService(
        {
          type: 'rest',
          url: server.getUrl('/api/users/1'),
          method: 'GET',
          cacheStore: store,
        },
        {},
        'fetchUser',
      );

      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.body, { id: 1, name: 'cached-user' });
      assert.strictEqual(result.metadata?.executionStatus, 'executed');
    } finally {
      await server.close();
    }
  });

  it('should serve a cached response on the second request (cache HIT)', async () => {
    const store = new cacheStores.MemoryCacheStore();
    let requestCount = 0;

    const server = new MockServer((_req: any, res: any) => {
      requestCount++;
      res.writeHead(200, {
        'content-type': 'application/json',
        'cache-control': 'max-age=300',
      });
      res.end(JSON.stringify({ id: requestCount }));
    });
    await server.listen();

    const config = {
      type: 'rest' as const,
      url: server.getUrl('/api/item'),
      method: 'GET',
      cacheStore: store,
    };

    try {
      const first = await executeRestService(config, {}, 'fetchItem');
      assert.strictEqual(first.status, 200);
      assert.strictEqual(first.body.id, 1);

      const second = await executeRestService(config, {}, 'fetchItem');
      assert.strictEqual(second.status, 200);
      assert.strictEqual(second.body.id, 1, 'second response should be the cached value');
      assert.strictEqual(requestCount, 1, 'server should only be called once when response is cached');
    } finally {
      await server.close();
    }
  });

  it('should preserve global interceptor when cacheStore is also set', async () => {
    originalDispatcher = getGlobalDispatcher();

    // Global interceptor that injects a custom header on every request
    const globalInterceptor = (dispatch: Dispatcher['dispatch']): Dispatcher['dispatch'] => {
      return (opts, handler) => {
        const headers = { ...(opts.headers as Record<string, string> ?? {}), 'x-global': 'true' };
        return dispatch({ ...opts, headers }, handler);
      };
    };
    setGlobalDispatcher(new Agent().compose(globalInterceptor));

    const store = new cacheStores.MemoryCacheStore();
    let requestCount = 0;

    const server = new MockServer((req: any, res: any) => {
      requestCount++;
      res.writeHead(200, {
        'content-type': 'application/json',
        'cache-control': 'max-age=300',
        // Echo the global header back so we can assert it was injected
        'x-saw-global': req.headers['x-global'] ?? 'false',
      });
      res.end(JSON.stringify({ id: requestCount }));
    });
    await server.listen();

    const config = {
      type: 'rest' as const,
      url: server.getUrl('/api/item'),
      method: 'GET',
      cacheStore: store,
    };

    try {
      // First request — hits the server; global interceptor must have run
      const first = await executeRestService(config, {}, 'fetchItem');
      assert.strictEqual(first.status, 200);
      assert.strictEqual(first.headers?.['x-saw-global'], 'true', 'global interceptor should have injected x-global header');

      // Second request — served from cache; server not called again
      const second = await executeRestService(config, {}, 'fetchItem');
      assert.strictEqual(second.status, 200);
      assert.strictEqual(second.body.id, 1, 'second response should be cached');
      assert.strictEqual(requestCount, 1, 'server should only be called once due to caching');
    } finally {
      await server.close();
    }
  });

  it('should work without a cacheStore', async () => {
    const server = new MockServer((_req: any, res: any) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 2, name: 'no-cache' }));
    });
    await server.listen();

    try {
      const result = await executeRestService(
        {
          type: 'rest',
          url: server.getUrl('/api/users/2'),
          method: 'GET',
        },
        {},
        'fetchUser',
      );

      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.body, { id: 2, name: 'no-cache' });
      assert.strictEqual(result.metadata?.executionStatus, 'executed');
    } finally {
      await server.close();
    }
  });
});
