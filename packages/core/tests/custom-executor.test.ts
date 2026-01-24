import { describe, it } from 'node:test';
import assert from 'node:assert';
import { executeCustomService } from '../src/custom-executor.js';
import type { CustomServiceConfig, OrchestrationContext } from '../src/types.js';

describe('Custom Executor', () => {
  describe('Basic execution', () => {
    it('should execute custom handler and return result', async () => {
      const config: CustomServiceConfig = {
        type: 'custom',
        handler: async (context) => {
          return {
            status: 200,
            body: { processed: true },
          };
        },
      };

      const result = await executeCustomService(config, {}, 'customService1');

      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.body, { processed: true });
    });

    it('should pass context to custom handler', async () => {
      const context: OrchestrationContext = {
        request: {
          body: { userId: 'user123' },
        },
        previousService: {
          status: 200,
          body: { token: 'abc123' },
        },
      };

      const config: CustomServiceConfig = {
        type: 'custom',
        handler: async (ctx) => {
          return {
            status: 200,
            body: {
              userId: ctx.request?.body?.userId,
              token: ctx.previousService?.body?.token,
            },
          };
        },
      };

      const result = await executeCustomService(config, context, 'customService2');

      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.body, { userId: 'user123', token: 'abc123' });
    });

    it('should handle synchronous handlers', async () => {
      const config: CustomServiceConfig = {
        type: 'custom',
        handler: (context) => {
          return {
            status: 200,
            body: { sync: true },
          };
        },
      };

      const result = await executeCustomService(config, {}, 'syncService');

      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.body, { sync: true });
    });
  });

  describe('Complex handlers', () => {
    it('should support database-like operations', async () => {
      const mockDatabase: Record<string, any> = {
        user1: { id: 'user1', name: 'John', email: 'john@example.com' },
        user2: { id: 'user2', name: 'Jane', email: 'jane@example.com' },
      };

      const config: CustomServiceConfig = {
        type: 'custom',
        handler: async (context) => {
          const userId = context.request?.body?.userId;
          const user = mockDatabase[userId];

          if (!user) {
            return {
              status: 404,
              body: { error: 'User not found' },
            };
          }

          return {
            status: 200,
            body: user,
          };
        },
      };

      const context: OrchestrationContext = {
        request: { body: { userId: 'user1' } },
      };

      const result = await executeCustomService(config, context, 'dbService');

      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.body, { id: 'user1', name: 'John', email: 'john@example.com' });
    });

    it('should support file system-like operations', async () => {
      const config: CustomServiceConfig = {
        type: 'custom',
        handler: async (context) => {
          // Simulate reading a config file
          const configData = {
            appName: 'flow-stack',
            version: '1.0.0',
            features: ['rest', 'custom'],
          };

          return {
            status: 200,
            body: configData,
          };
        },
      };

      const result = await executeCustomService(config, {}, 'fsService');

      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.body.features, ['rest', 'custom']);
    });

    it('should support message queue-like operations', async () => {
      const messages: string[] = [];

      const config: CustomServiceConfig = {
        type: 'custom',
        handler: async (context) => {
          const message = context.request?.body?.message;
          messages.push(message);

          return {
            status: 200,
            body: { queued: true, messageId: messages.length },
          };
        },
      };

      const context: OrchestrationContext = {
        request: { body: { message: 'Hello, World!' } },
      };

      const result = await executeCustomService(config, context, 'mqService');

      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.body.queued, true);
      assert.strictEqual(messages[0], 'Hello, World!');
    });
  });

  describe('Error handling', () => {
    it('should handle errors and return error result', async () => {
      const config: CustomServiceConfig = {
        type: 'custom',
        handler: async () => {
          throw new Error('Custom handler failed');
        },
      };

      const result = await executeCustomService(config, {}, 'errorService');

      assert.strictEqual(result.status, null);
      assert.strictEqual(result.body, null);
      assert.ok(result.error);
      assert.strictEqual(result.error.message, 'Custom handler failed');
      assert.strictEqual(result.metadata?.executionStatus, 'failed');
    });

    it('should use fallback when handler throws', async () => {
      const config: CustomServiceConfig = {
        type: 'custom',
        handler: async () => {
          throw new Error('Service unavailable');
        },
        fallback: {
          status: null,
          data: { fallback: true, defaultValue: 'N/A' },
        },
      };

      const result = await executeCustomService(config, {}, 'fallbackService');

      assert.strictEqual(result.status, null);
      assert.deepStrictEqual(result.body, { fallback: true, defaultValue: 'N/A' });
      assert.strictEqual(result.metadata?.fallbackUsed, true);
      assert.strictEqual(result.metadata?.executionStatus, 'failed');
    });

    it('should handle errors with custom error codes', async () => {
      const config: CustomServiceConfig = {
        type: 'custom',
        handler: async () => {
          const error = new Error('Connection refused') as any;
          error.code = 'ECONNREFUSED';
          throw error;
        },
      };

      const result = await executeCustomService(config, {}, 'codeErrorService');

      assert.strictEqual(result.error.message, 'Connection refused');
      assert.strictEqual(result.error.code, 'ECONNREFUSED');
    });
  });

  describe('Result passthrough', () => {
    it('should return handler result as-is', async () => {
      const config: CustomServiceConfig = {
        type: 'custom',
        handler: async () => ({
          status: 201,
          body: { data: 'test' },
          headers: { 'x-custom': 'value' },
          metadata: {
            executionStatus: 'executed' as const,
            customField: 'customValue',
          } as any,
        }),
      };

      const result = await executeCustomService(config, {}, 'passthroughService');

      assert.strictEqual(result.status, 201);
      assert.deepStrictEqual(result.body, { data: 'test' });
      assert.deepStrictEqual(result.headers, { 'x-custom': 'value' });
      assert.strictEqual(result.metadata?.executionStatus, 'executed');
      assert.strictEqual((result.metadata as any)?.customField, 'customValue');
    });
  });
});
