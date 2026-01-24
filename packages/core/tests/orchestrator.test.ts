import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { runOrchestration } from '../src/orchestrator.js';
import { registerPlugin, unregisterPlugin, clearPlugins } from '../src/plugin-registry.js';
import type { ServiceBlock, OrchestrationContext, FlowStackPlugin, BaseServiceConfig, ServiceResult } from '../src/types.js';

// Mock plugin for testing
interface MockServiceConfig extends BaseServiceConfig {
  type: 'mock';
  data: any;
  shouldFail?: boolean;
}

const mockPlugin: FlowStackPlugin<MockServiceConfig> = {
  type: 'mock',
  name: 'mock-plugin',
  version: '1.0.0',
  execute: async (config, context, serviceId) => {
    if (config.shouldFail) {
      throw new Error('Mock service failed');
    }
    return {
      status: 200,
      body: config.data,
      metadata: {
        executionStatus: 'executed',
        serviceType: 'mock',
      },
    };
  },
  interpolate: true,
};

// Plugin that doesn't interpolate
const noInterpolatePlugin: FlowStackPlugin<MockServiceConfig> = {
  type: 'no-interpolate',
  name: 'no-interpolate-plugin',
  version: '1.0.0',
  execute: async (config, context, serviceId) => {
    return {
      status: 200,
      body: config.data,
      metadata: {
        executionStatus: 'executed',
        serviceType: 'no-interpolate',
      },
    };
  },
  interpolate: false,
};

describe('Orchestrator', () => {
  beforeEach(() => {
    clearPlugins();
  });

  afterEach(() => {
    clearPlugins();
  });

  describe('Custom service orchestration', () => {
    it('should execute single custom service', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'customService',
          service: {
            type: 'custom',
            handler: async (context) => {
              return {
                status: 200,
                body: { message: 'Hello from custom handler' },
              };
            },
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.customService.status, 200);
      assert.deepStrictEqual(result.services.customService.body, { message: 'Hello from custom handler' });
    });

    it('should execute custom services with dependencies', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'generateId',
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { id: 'unique-id-123' },
            }),
          },
        },
        {
          id: 'useId',
          dependsOn: ['generateId'],
          service: {
            type: 'custom',
            handler: async (context) => {
              const generatedId = context.generateId?.body?.id;
              return {
                status: 200,
                body: { receivedId: generatedId, processed: true },
              };
            },
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.generateId.body.id, 'unique-id-123');
      assert.strictEqual(result.services.useId.body.receivedId, 'unique-id-123');
      assert.strictEqual(result.services.useId.body.processed, true);
    });

    it('should pass context to custom handler', async () => {
      let receivedContext: any;

      const services: ServiceBlock[] = [
        {
          id: 'testService',
          service: {
            type: 'custom',
            handler: async (context) => {
              receivedContext = context;
              return { status: 200, body: {} };
            },
          },
        },
      ];

      const context: OrchestrationContext = {
        request: { body: { test: true } },
        env: { API_KEY: 'secret' },
      };

      await runOrchestration(services, context);

      assert.strictEqual(receivedContext.request?.body?.test, true);
      assert.strictEqual(receivedContext.env?.API_KEY, 'secret');
    });
  });

  describe('Plugin-based service orchestration', () => {
    it('should execute service using registered plugin', async () => {
      registerPlugin(mockPlugin);

      const services: ServiceBlock[] = [
        {
          id: 'mockService',
          service: {
            type: 'mock',
            data: { result: 'from mock' },
          } as any,
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.mockService.status, 200);
      assert.deepStrictEqual(result.services.mockService.body, { result: 'from mock' });
      assert.strictEqual(result.services.mockService.metadata?.serviceType, 'mock');
    });

    it('should interpolate plugin config by default', async () => {
      registerPlugin(mockPlugin);

      const services: ServiceBlock[] = [
        {
          id: 'mockService',
          service: {
            type: 'mock',
            data: { userId: '{request.body.id}' },
          } as any,
        },
      ];

      const context: OrchestrationContext = {
        request: { body: { id: 'user-123' } },
      };

      const result = await runOrchestration(services, context);

      assert.deepStrictEqual(result.services.mockService.body, { userId: 'user-123' });
    });

    it('should not interpolate when plugin.interpolate is false', async () => {
      registerPlugin(noInterpolatePlugin);

      const services: ServiceBlock[] = [
        {
          id: 'rawService',
          service: {
            type: 'no-interpolate',
            data: { template: '{request.body.id}' },
          } as any,
        },
      ];

      const context: OrchestrationContext = {
        request: { body: { id: 'user-123' } },
      };

      const result = await runOrchestration(services, context);

      // Should NOT be interpolated
      assert.deepStrictEqual(result.services.rawService.body, { template: '{request.body.id}' });
    });

    it('should execute mixed custom and plugin services', async () => {
      registerPlugin(mockPlugin);

      const services: ServiceBlock[] = [
        {
          id: 'prepareData',
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { prepared: true, value: 42 },
            }),
          },
        },
        {
          id: 'mockService',
          dependsOn: ['prepareData'],
          service: {
            type: 'mock',
            data: { fromPrepare: '{prepareData.body.value}' },
          } as any,
        },
        {
          id: 'finalProcess',
          dependsOn: ['mockService'],
          service: {
            type: 'custom',
            handler: async (context) => ({
              status: 200,
              body: {
                mockResult: context.mockService?.body,
                combined: true,
              },
            }),
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.mockService.metadata?.serviceType, 'mock');
      assert.strictEqual(result.services.finalProcess.body.combined, true);
      assert.deepStrictEqual(result.services.finalProcess.body.mockResult, { fromPrepare: 42 });
    });
  });

  describe('Unregistered plugin handling', () => {
    it('should return error for unregistered service type', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'unknownService',
          service: {
            type: 'unregistered' as any,
          } as any,
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.unknownService.status, null);
      assert.strictEqual(result.services.unknownService.body, null);
      assert.ok(result.services.unknownService.error);
      assert.ok(result.services.unknownService.error.message.includes('Unknown service type'));
      assert.ok(result.services.unknownService.error.message.includes('Did you forget to register a plugin?'));
      assert.strictEqual(result.services.unknownService.metadata?.executionStatus, 'failed');
    });
  });

  describe('Conditional execution', () => {
    it('should skip service when condition returns false', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'checkCondition',
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { shouldProceed: false },
            }),
          },
        },
        {
          id: 'conditionalService',
          dependsOn: ['checkCondition'],
          condition: (context) => {
            const check = context.getAll().checkCondition;
            return check?.body?.shouldProceed === true;
          },
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { executed: true },
            }),
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.checkCondition.body.shouldProceed, false);
      assert.strictEqual(result.services.conditionalService.metadata?.executionStatus, 'skipped');
    });

    it('should execute service when condition returns true', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'checkCondition',
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { shouldProceed: true },
            }),
          },
        },
        {
          id: 'conditionalService',
          dependsOn: ['checkCondition'],
          condition: (context) => {
            const check = context.getAll().checkCondition;
            return check?.body?.shouldProceed === true;
          },
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { executed: true },
            }),
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.conditionalService.body.executed, true);
    });
  });

  describe('Error handling', () => {
    it('should handle errors with silent strategy (default)', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'failingService',
          service: {
            type: 'custom',
            handler: async () => {
              throw new Error('Service failed');
            },
          },
        },
        {
          id: 'nextService',
          dependsOn: ['failingService'],
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { shouldNotExecute: true },
            }),
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.failingService.metadata?.executionStatus, 'failed');
    });

    it('should use fallback when service fails', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'failingService',
          service: {
            type: 'custom',
            handler: async () => {
              throw new Error('Service unavailable');
            },
            fallback: {
              data: { fallbackData: true },
            },
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.deepStrictEqual(result.services.failingService.body, { fallbackData: true });
      assert.strictEqual(result.services.failingService.metadata?.fallbackUsed, true);
    });

    it('should throw error with throw strategy and stop dependent services', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'criticalService',
          errorStrategy: 'throw',
          service: {
            type: 'custom',
            handler: async () => {
              throw new Error('Critical failure');
            },
          },
        },
        {
          id: 'dependentService',
          dependsOn: ['criticalService'],
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { executed: true },
            }),
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.ok(result.services.criticalService);
      assert.strictEqual(result.services.criticalService.metadata?.executionStatus, 'failed');
      assert.strictEqual(result.services.dependentService.metadata?.executionStatus, 'pending');
    });

    it('should handle throw strategy with service-level errorStrategy', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'failWithThrow',
          service: {
            type: 'custom',
            handler: async () => {
              throw new Error('Handler error');
            },
            errorStrategy: 'throw',
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.ok(result.services.failWithThrow);
      assert.strictEqual(result.services.failWithThrow.metadata?.executionStatus, 'failed');
    });

    it('should handle failed service with error result containing metadata', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'errorWithMetadata',
          errorStrategy: 'throw',
          service: {
            type: 'custom',
            handler: async () => ({
              status: 500,
              body: { error: 'Internal error' },
              error: { message: 'Something went wrong' },
              metadata: { executionStatus: 'failed' as const },
            }),
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.ok(result.services.errorWithMetadata);
    });

    it('should handle plugin execution errors', async () => {
      registerPlugin(mockPlugin);

      const services: ServiceBlock[] = [
        {
          id: 'failingMockService',
          service: {
            type: 'mock',
            data: { test: true },
            shouldFail: true,
          } as any,
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.failingMockService.metadata?.executionStatus, 'failed');
      assert.ok(result.services.failingMockService.error);
    });
  });

  describe('Skipped services with fallback', () => {
    it('should use fallback data for skipped service', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'skippedWithFallback',
          condition: () => false,
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { executed: true },
            }),
            fallback: {
              status: 204,
              data: { skippedData: true, reason: 'condition was false' },
            },
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.skippedWithFallback.status, 204);
      assert.deepStrictEqual(result.services.skippedWithFallback.body, {
        skippedData: true,
        reason: 'condition was false',
      });
      assert.strictEqual(result.services.skippedWithFallback.metadata?.executionStatus, 'skipped');
      assert.strictEqual(result.services.skippedWithFallback.metadata?.fallbackUsed, true);
    });

    it('should handle skipped service without fallback', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'skippedNoFallback',
          condition: () => false,
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { executed: true },
            }),
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.skippedNoFallback.status, null);
      assert.strictEqual(result.services.skippedNoFallback.body, undefined);
      assert.strictEqual(result.services.skippedNoFallback.metadata?.executionStatus, 'skipped');
      assert.strictEqual(result.services.skippedNoFallback.metadata?.fallbackUsed, false);
    });
  });

  describe('Pending services', () => {
    it('should mark service as pending when dependency fails with throw', async () => {
      const services: ServiceBlock[] = [
        {
          id: 'failFirst',
          errorStrategy: 'throw',
          service: {
            type: 'custom',
            handler: async () => {
              throw new Error('First service failed');
            },
          },
        },
        {
          id: 'pendingSecond',
          dependsOn: ['failFirst'],
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { shouldNeverRun: true },
            }),
          },
        },
        {
          id: 'pendingThird',
          dependsOn: ['pendingSecond'],
          service: {
            type: 'custom',
            handler: async () => ({
              status: 200,
              body: { alsoNeverRuns: true },
            }),
          },
        },
      ];

      const result = await runOrchestration(services, {});

      assert.strictEqual(result.services.failFirst.metadata?.executionStatus, 'failed');
      assert.strictEqual(result.services.pendingSecond.metadata?.executionStatus, 'pending');
      assert.strictEqual(result.services.pendingThird.metadata?.executionStatus, 'pending');
      assert.strictEqual(result.services.pendingSecond.status, null);
      assert.strictEqual(result.services.pendingSecond.body, null);
    });
  });

  describe('Parallel execution', () => {
    it('should execute independent services in parallel', async () => {
      const executionOrder: string[] = [];

      const services: ServiceBlock[] = [
        {
          id: 'service1',
          service: {
            type: 'custom',
            handler: async () => {
              executionOrder.push('service1-start');
              await new Promise(resolve => setTimeout(resolve, 50));
              executionOrder.push('service1-end');
              return { status: 200, body: { service: 1 } };
            },
          },
        },
        {
          id: 'service2',
          service: {
            type: 'custom',
            handler: async () => {
              executionOrder.push('service2-start');
              await new Promise(resolve => setTimeout(resolve, 50));
              executionOrder.push('service2-end');
              return { status: 200, body: { service: 2 } };
            },
          },
        },
        {
          id: 'service3',
          dependsOn: ['service1', 'service2'],
          service: {
            type: 'custom',
            handler: async () => {
              executionOrder.push('service3');
              return { status: 200, body: { service: 3 } };
            },
          },
        },
      ];

      await runOrchestration(services, {});

      const service1StartIndex = executionOrder.indexOf('service1-start');
      const service2StartIndex = executionOrder.indexOf('service2-start');
      const service1EndIndex = executionOrder.indexOf('service1-end');
      const service2EndIndex = executionOrder.indexOf('service2-end');
      const service3Index = executionOrder.indexOf('service3');

      assert.ok(service1StartIndex < service1EndIndex);
      assert.ok(service2StartIndex < service2EndIndex);
      assert.ok(service3Index > service1EndIndex);
      assert.ok(service3Index > service2EndIndex);
    });
  });
});
