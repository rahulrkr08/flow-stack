import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { channel } from 'node:diagnostics_channel';
import { channels, emitServiceStart, emitServiceComplete, emitServiceError } from '../src/diagnostics.js';
import { executeCustomService } from '../src/custom-executor.js';

describe('Diagnostics', () => {
  describe('Channel exports', () => {
    it('should export all diagnostic channels', () => {
      assert.ok(channels.start);
      assert.ok(channels.complete);
      assert.ok(channels.error);
    });

    it('should have correct channel names', () => {
      assert.strictEqual(channels.start.name, 'flow-stack:service:start');
      assert.strictEqual(channels.complete.name, 'flow-stack:service:complete');
      assert.strictEqual(channels.error.name, 'flow-stack:service:error');
    });
  });

  describe('emitServiceStart', () => {
    it('should emit start event with config when subscribed', async () => {
      const messages: any[] = [];
      const startChannel = channel('flow-stack:service:start');

      const handler = (message: any) => {
        messages.push(message);
      };

      startChannel.subscribe(handler);

      try {
        const config = {
          type: 'test',
          url: 'https://api.example.com/users',
          method: 'GET',
          headers: { 'Authorization': 'Bearer token' },
        };

        emitServiceStart('testService', 'test', config, {});

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].serviceId, 'testService');
        assert.strictEqual(messages[0].serviceType, 'test');
        assert.ok(messages[0].timestamp);
        assert.strictEqual(messages[0].config.type, 'test');
        assert.strictEqual(messages[0].config.url, 'https://api.example.com/users');
      } finally {
        startChannel.unsubscribe(handler);
      }
    });

    it('should emit start event for custom service without config details', async () => {
      const messages: any[] = [];
      const startChannel = channel('flow-stack:service:start');

      const handler = (message: any) => {
        messages.push(message);
      };

      startChannel.subscribe(handler);

      try {
        emitServiceStart('customService', 'custom', null, {});

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].serviceId, 'customService');
        assert.strictEqual(messages[0].serviceType, 'custom');
        assert.ok(messages[0].timestamp);
        assert.strictEqual(messages[0].config, undefined);
      } finally {
        startChannel.unsubscribe(handler);
      }
    });

    it('should not emit when no subscribers', () => {
      // No subscribers, should not throw
      emitServiceStart('noSubService', 'test', {
        type: 'test',
      }, {});
    });

    it('should strip fallback and errorStrategy from config', async () => {
      const messages: any[] = [];
      const startChannel = channel('flow-stack:service:start');

      const handler = (message: any) => {
        messages.push(message);
      };

      startChannel.subscribe(handler);

      try {
        const config = {
          type: 'test',
          url: 'https://example.com',
          fallback: { data: 'secret' },
          errorStrategy: 'throw' as const,
        };

        emitServiceStart('testService', 'test', config, {});

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].config.url, 'https://example.com');
        assert.strictEqual(messages[0].config.fallback, undefined);
        assert.strictEqual(messages[0].config.errorStrategy, undefined);
      } finally {
        startChannel.unsubscribe(handler);
      }
    });
  });

  describe('emitServiceComplete', () => {
    it('should emit complete event with config when subscribed', async () => {
      const messages: any[] = [];
      const completeChannel = channel('flow-stack:service:complete');

      const handler = (message: any) => {
        messages.push(message);
      };

      completeChannel.subscribe(handler);

      try {
        const config = {
          type: 'test',
          url: 'https://api.example.com/data',
          method: 'POST',
        };

        emitServiceComplete('completeService', 'test', config, {}, 150, 200, false);

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].serviceId, 'completeService');
        assert.strictEqual(messages[0].serviceType, 'test');
        assert.strictEqual(messages[0].processingTime, 150);
        assert.strictEqual(messages[0].status, 200);
        assert.strictEqual(messages[0].fallbackUsed, false);
        assert.ok(messages[0].timestamp);
        assert.strictEqual(messages[0].config.url, 'https://api.example.com/data');
      } finally {
        completeChannel.unsubscribe(handler);
      }
    });

    it('should emit complete event for custom service without config details', async () => {
      const messages: any[] = [];
      const completeChannel = channel('flow-stack:service:complete');

      const handler = (message: any) => {
        messages.push(message);
      };

      completeChannel.subscribe(handler);

      try {
        emitServiceComplete('customComplete', 'custom', null, {}, 50, 200, false);

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].serviceId, 'customComplete');
        assert.strictEqual(messages[0].serviceType, 'custom');
        assert.strictEqual(messages[0].processingTime, 50);
        assert.strictEqual(messages[0].status, 200);
        assert.strictEqual(messages[0].config, undefined);
      } finally {
        completeChannel.unsubscribe(handler);
      }
    });

    it('should emit complete event with fallbackUsed flag', async () => {
      const messages: any[] = [];
      const completeChannel = channel('flow-stack:service:complete');

      const handler = (message: any) => {
        messages.push(message);
      };

      completeChannel.subscribe(handler);

      try {
        emitServiceComplete('fallbackService', 'test', null, {}, 100, null, true);

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].fallbackUsed, true);
        assert.strictEqual(messages[0].status, null);
      } finally {
        completeChannel.unsubscribe(handler);
      }
    });
  });

  describe('emitServiceError', () => {
    it('should emit error event with config when subscribed', async () => {
      const messages: any[] = [];
      const errorChannel = channel('flow-stack:service:error');

      const handler = (message: any) => {
        messages.push(message);
      };

      errorChannel.subscribe(handler);

      try {
        const config = {
          type: 'test',
          url: 'https://api.example.com/fail',
          method: 'GET',
        };

        const error = new Error('Connection refused');
        (error as any).code = 'ECONNREFUSED';

        emitServiceError('errorService', 'test', config, {}, 25, error);

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].serviceId, 'errorService');
        assert.strictEqual(messages[0].serviceType, 'test');
        assert.strictEqual(messages[0].processingTime, 25);
        assert.strictEqual(messages[0].error.message, 'Connection refused');
        assert.strictEqual(messages[0].error.code, 'ECONNREFUSED');
        assert.ok(messages[0].timestamp);
        assert.strictEqual(messages[0].config.url, 'https://api.example.com/fail');
      } finally {
        errorChannel.unsubscribe(handler);
      }
    });

    it('should emit error event for custom service without config details', async () => {
      const messages: any[] = [];
      const errorChannel = channel('flow-stack:service:error');

      const handler = (message: any) => {
        messages.push(message);
      };

      errorChannel.subscribe(handler);

      try {
        const error = new Error('Custom handler error');
        emitServiceError('customError', 'custom', null, {}, 10, error);

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].serviceId, 'customError');
        assert.strictEqual(messages[0].serviceType, 'custom');
        assert.strictEqual(messages[0].error.message, 'Custom handler error');
        assert.strictEqual(messages[0].config, undefined);
      } finally {
        errorChannel.unsubscribe(handler);
      }
    });

    it('should handle error without message property', async () => {
      const messages: any[] = [];
      const errorChannel = channel('flow-stack:service:error');

      const handler = (message: any) => {
        messages.push(message);
      };

      errorChannel.subscribe(handler);

      try {
        // Error without message (uses String conversion)
        emitServiceError('stringError', 'custom', null, {}, 5, 'Simple string error');

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].error.message, 'Simple string error');
      } finally {
        errorChannel.unsubscribe(handler);
      }
    });
  });

  describe('Integration with Custom executor', () => {
    it('should emit start and complete events for successful custom service', async () => {
      const startMessages: any[] = [];
      const completeMessages: any[] = [];

      const startChannel = channel('flow-stack:service:start');
      const completeChannel = channel('flow-stack:service:complete');

      const startHandler = (message: any) => startMessages.push(message);
      const completeHandler = (message: any) => completeMessages.push(message);

      startChannel.subscribe(startHandler);
      completeChannel.subscribe(completeHandler);

      try {
        await executeCustomService({
          type: 'custom',
          handler: async () => ({ status: 200, body: { done: true } }),
        }, {}, 'customIntegration');

        assert.strictEqual(startMessages.length, 1);
        assert.strictEqual(startMessages[0].serviceId, 'customIntegration');
        assert.strictEqual(startMessages[0].serviceType, 'custom');

        assert.strictEqual(completeMessages.length, 1);
        assert.strictEqual(completeMessages[0].serviceId, 'customIntegration');
        assert.strictEqual(completeMessages[0].serviceType, 'custom');
      } finally {
        startChannel.unsubscribe(startHandler);
        completeChannel.unsubscribe(completeHandler);
      }
    });

    it('should emit start and error events for failed custom service', async () => {
      const startMessages: any[] = [];
      const errorMessages: any[] = [];

      const startChannel = channel('flow-stack:service:start');
      const errorChannel = channel('flow-stack:service:error');

      const startHandler = (message: any) => startMessages.push(message);
      const errorHandler = (message: any) => errorMessages.push(message);

      startChannel.subscribe(startHandler);
      errorChannel.subscribe(errorHandler);

      try {
        await executeCustomService({
          type: 'custom',
          handler: async () => { throw new Error('Custom failure'); },
        }, {}, 'failingCustom');

        assert.strictEqual(startMessages.length, 1);
        assert.strictEqual(startMessages[0].serviceId, 'failingCustom');

        assert.strictEqual(errorMessages.length, 1);
        assert.strictEqual(errorMessages[0].serviceId, 'failingCustom');
        assert.strictEqual(errorMessages[0].error.message, 'Custom failure');
      } finally {
        startChannel.unsubscribe(startHandler);
        errorChannel.unsubscribe(errorHandler);
      }
    });
  });

  describe('Dynamic service types', () => {
    it('should support any string as service type', async () => {
      const messages: any[] = [];
      const startChannel = channel('flow-stack:service:start');

      const handler = (message: any) => {
        messages.push(message);
      };

      startChannel.subscribe(handler);

      try {
        emitServiceStart('service1', 'graphql', { type: 'graphql', query: '{ users }' } as any, {});
        emitServiceStart('service2', 'grpc', { type: 'grpc', method: 'GetUser' } as any, {});
        emitServiceStart('service3', 'websocket', { type: 'websocket', url: 'ws://example.com' } as any, {});

        assert.strictEqual(messages.length, 3);
        assert.strictEqual(messages[0].serviceType, 'graphql');
        assert.strictEqual(messages[1].serviceType, 'grpc');
        assert.strictEqual(messages[2].serviceType, 'websocket');
      } finally {
        startChannel.unsubscribe(handler);
      }
    });
  });
});
