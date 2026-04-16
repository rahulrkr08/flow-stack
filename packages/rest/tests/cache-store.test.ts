import { describe, it } from 'node:test';
import assert from 'node:assert';
import undici from 'undici';
import { executeRestService } from '../src/rest-executor.js';
import { MockServer } from './helpers.js';

const { cacheStores } = undici;

describe('Cache Store Integration', () => {
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

    // Server sends Cache-Control so undici knows the response is cacheable
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
      // First request — cache MISS, hits the server
      const first = await executeRestService(config, {}, 'fetchItem');
      assert.strictEqual(first.status, 200);
      assert.strictEqual(first.body.id, 1);

      // Second request — served from the in-memory cache
      const second = await executeRestService(config, {}, 'fetchItem');
      assert.strictEqual(second.status, 200);
      assert.strictEqual(second.body.id, 1, 'second response should be the cached value');

      // Server must only have been called once
      assert.strictEqual(requestCount, 1, 'server should only be called once when response is cached');
    } finally {
      await server.close();
    }
  });

  it('should work without a cacheStore (backwards compatible)', async () => {
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
          // No cacheStore provided
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
