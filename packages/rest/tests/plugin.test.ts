import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { registerPlugin, unregisterPlugin, runOrchestration, clearPlugins } from '@workflow-stack/core';
import { restPlugin } from '../src/plugin.js';
import type { RestServiceConfig } from '../src/types.js';
import { MockServer, jsonHandler, echoBodyHandler } from './helpers.js';

describe('REST Plugin', () => {
  beforeEach(() => {
    clearPlugins();
    registerPlugin(restPlugin);
  });

  afterEach(() => {
    clearPlugins();
  });

  describe('Plugin registration', () => {
    it('should have correct plugin metadata', () => {
      assert.strictEqual(restPlugin.type, 'rest');
      assert.strictEqual(restPlugin.name, '@workflow-stack/rest');
      assert.strictEqual(restPlugin.version, '1.0.0');
      assert.strictEqual(restPlugin.interpolate, true);
    });
  });

  describe('Orchestration with REST plugin', () => {
    it('should execute single REST service', async () => {
      const server = new MockServer(jsonHandler({ id: 1, name: 'test' }));
      await server.listen();

      try {
        const result = await runOrchestration([
          {
            id: 'service1',
            service: {
              type: 'rest',
              url: server.getUrl('/api/users/1'),
              method: 'GET',
            } as RestServiceConfig,
          },
        ], {});

        assert.strictEqual(result.services.service1.status, 200);
        assert.deepStrictEqual(result.services.service1.body, { id: 1, name: 'test' });
        assert.strictEqual(result.services.service1.metadata?.serviceType, 'rest');
      } finally {
        await server.close();
      }
    });

    it('should execute REST services with dependencies', async () => {
      const authServer = new MockServer(jsonHandler({ token: 'jwt123' }));
      const dataServer = new MockServer((req, res) => {
        const auth = req.headers['authorization'];
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ authorized: auth === 'Bearer jwt123', data: 'secret' }));
      });

      await authServer.listen();
      await dataServer.listen();

      try {
        const result = await runOrchestration([
          {
            id: 'auth',
            service: {
              type: 'rest',
              url: authServer.getUrl('/login'),
              method: 'POST',
              body: { username: 'admin' },
            } as RestServiceConfig,
          },
          {
            id: 'getData',
            dependsOn: ['auth'],
            service: {
              type: 'rest',
              url: dataServer.getUrl('/api/data'),
              method: 'GET',
              headers: {
                'Authorization': 'Bearer {auth.body.token}',
              },
            } as RestServiceConfig,
          },
        ], {});

        assert.strictEqual(result.services.auth.status, 200);
        assert.strictEqual(result.services.getData.status, 200);
        assert.strictEqual(result.services.getData.body.authorized, true);
      } finally {
        await authServer.close();
        await dataServer.close();
      }
    });

    it('should interpolate context values in REST config', async () => {
      const server = new MockServer(echoBodyHandler());
      await server.listen();

      try {
        const result = await runOrchestration([
          {
            id: 'postData',
            service: {
              type: 'rest',
              url: server.getUrl('/api/submit'),
              method: 'POST',
              body: {
                userId: '{request.body.userId}',
                action: '{request.query.action}',
              },
            } as RestServiceConfig,
          },
        ], {
          request: {
            body: { userId: 'user-789' },
            query: { action: 'create' },
          },
        });

        assert.deepStrictEqual(result.services.postData.body.received, {
          userId: 'user-789',
          action: 'create',
        });
      } finally {
        await server.close();
      }
    });

    it('should work with mixed custom and REST services', async () => {
      const server = new MockServer(jsonHandler({ apiData: 'from-rest-api' }));
      await server.listen();

      try {
        const result = await runOrchestration([
          {
            id: 'prepareData',
            service: {
              type: 'custom',
              handler: async () => ({
                status: 200,
                body: { userId: 'user-456', timestamp: Date.now() },
              }),
            },
          },
          {
            id: 'fetchFromApi',
            dependsOn: ['prepareData'],
            service: {
              type: 'rest',
              url: server.getUrl('/api/data'),
              method: 'GET',
            } as RestServiceConfig,
          },
          {
            id: 'processResults',
            dependsOn: ['prepareData', 'fetchFromApi'],
            service: {
              type: 'custom',
              handler: async (context) => {
                const preparedData = context.prepareData?.body;
                const apiData = context.fetchFromApi?.body;
                return {
                  status: 200,
                  body: {
                    combined: true,
                    userId: preparedData?.userId,
                    apiResponse: apiData?.apiData,
                  },
                };
              },
            },
          },
        ], {});

        // Custom handlers return results as-is, so no metadata unless handler provides it
        assert.strictEqual(result.services.prepareData.metadata, undefined);
        // REST plugin sets metadata with serviceType
        assert.strictEqual(result.services.fetchFromApi.metadata?.serviceType, 'rest');
        // Custom handlers return results as-is
        assert.strictEqual(result.services.processResults.metadata, undefined);

        assert.strictEqual(result.services.processResults.body.combined, true);
        assert.strictEqual(result.services.processResults.body.userId, 'user-456');
        assert.strictEqual(result.services.processResults.body.apiResponse, 'from-rest-api');
      } finally {
        await server.close();
      }
    });
  });
});
