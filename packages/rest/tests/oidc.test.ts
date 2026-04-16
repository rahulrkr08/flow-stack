import { describe, it } from 'node:test';
import assert from 'node:assert';
import { executeRestService } from '../src/rest-executor.js';
import { MockServer } from './helpers.js';

/**
 * Build a minimal JWT the undici-oidc-interceptor can decode with fast-jwt.
 * The interceptor only decodes (not verifies), so an unsigned token is fine.
 */
function makeTestJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'test',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  return `${header}.${payload}.`;
}

/**
 * Minimal OIDC token endpoint — returns a valid JWT so the real
 * undici-oidc-interceptor can decode and cache it without error.
 */
function tokenHandler(_req: any, res: any) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    access_token: makeTestJwt(),
    token_type: 'Bearer',
    expires_in: 3600,
  }));
}

describe('OIDC interceptor', () => {
  it('should compose the OIDC interceptor and inject the Bearer token', async () => {
    const tokenServer = new MockServer(tokenHandler);
    await tokenServer.listen();

    const apiServer = new MockServer((req: any, res: any) => {
      // Echo back the Authorization header so we can assert the token was injected
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ auth: req.headers['authorization'] ?? null }));
    });
    await apiServer.listen();

    try {
      const result = await executeRestService(
        {
          type: 'rest',
          url: apiServer.getUrl('/api/users/1'),
          method: 'GET',
          oidc: {
            clientId: 'test-client',
            clientSecret: 'test-secret',
            idpTokenUrl: tokenServer.getUrl('/token'),
          },
        },
        {},
        'fetchUser',
      );

      assert.strictEqual(result.status, 200);
      assert.ok(
        typeof result.body.auth === 'string' && result.body.auth.startsWith('Bearer '),
        `expected Authorization header to start with 'Bearer ', got: ${result.body.auth}`,
      );
      assert.strictEqual(result.metadata?.executionStatus, 'executed');
    } finally {
      await tokenServer.close();
      await apiServer.close();
    }
  });

  it('should compose both OIDC and cache interceptors when both are configured', async () => {
    // @ts-ignore
    const { default: undici } = await import('undici');
    const store = new undici.cacheStores.MemoryCacheStore();

    const tokenServer = new MockServer(tokenHandler);
    await tokenServer.listen();

    let requestCount = 0;
    const apiServer = new MockServer((_req: any, res: any) => {
      requestCount++;
      res.writeHead(200, {
        'content-type': 'application/json',
        'cache-control': 'max-age=300',
      });
      res.end(JSON.stringify({ id: requestCount }));
    });
    await apiServer.listen();

    const config = {
      type: 'rest' as const,
      url: apiServer.getUrl('/api/item'),
      method: 'GET',
      oidc: {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        idpTokenUrl: tokenServer.getUrl('/token'),
      },
      cacheStore: store,
    };

    try {
      const first = await executeRestService(config, {}, 'fetchItem');
      assert.strictEqual(first.status, 200);
      assert.strictEqual(first.body.id, 1);

      // Second call should be served from cache — api server not called again
      const second = await executeRestService(config, {}, 'fetchItem');
      assert.strictEqual(second.status, 200);
      assert.strictEqual(second.body.id, 1, 'second response should be the cached value');
      assert.strictEqual(requestCount, 1, 'api server should only be called once');
    } finally {
      await tokenServer.close();
      await apiServer.close();
    }
  });
});
