import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sqsPlugin } from '../src/plugin.js';
import type { SqsServiceConfig } from '../src/types.js';

describe('SQS Plugin', () => {
  describe('Plugin definition', () => {
    it('should have correct type identifier', () => {
      assert.strictEqual(sqsPlugin.type, 'sqs');
    });

    it('should have correct name', () => {
      assert.strictEqual(sqsPlugin.name, '@workflow-stack/sqs');
    });

    it('should have interpolation enabled', () => {
      assert.strictEqual(sqsPlugin.interpolate, true);
    });

    it('should have an execute function', () => {
      assert.strictEqual(typeof sqsPlugin.execute, 'function');
    });
  });
});

describe('SQS Types', () => {
  describe('SqsServiceConfig', () => {
    it('should accept valid access key credentials config', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        credentials: {
          type: 'accessKey',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
        message: {
          body: 'Test message',
        },
      };

      assert.strictEqual(config.type, 'sqs');
      assert.strictEqual(config.credentials?.type, 'accessKey');
    });

    it('should accept valid assume role credentials config', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        credentials: {
          type: 'assumeRole',
          roleArn: 'arn:aws:iam::123456789012:role/MyRole',
          roleSessionName: 'my-session',
          externalId: 'external-123',
          durationSeconds: 3600,
        },
        message: {
          body: 'Test message',
        },
      };

      assert.strictEqual(config.type, 'sqs');
      assert.strictEqual(config.credentials?.type, 'assumeRole');
    });

    it('should accept config without explicit credentials (uses default chain)', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        message: {
          body: 'Test message',
        },
      };

      assert.strictEqual(config.type, 'sqs');
      assert.strictEqual(config.credentials, undefined);
    });

    it('should accept retry configuration', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        message: {
          body: 'Test message',
        },
        retry: {
          maxAttempts: 5,
          retryMode: 'adaptive',
        },
      };

      assert.strictEqual(config.retry?.maxAttempts, 5);
      assert.strictEqual(config.retry?.retryMode, 'adaptive');
    });

    it('should accept async mode configuration', () => {
      const configAsync: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        message: {
          body: 'Test message',
        },
        async: true,
      };

      const configSync: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        message: {
          body: 'Test message',
        },
        async: false,
      };

      assert.strictEqual(configAsync.async, true);
      assert.strictEqual(configSync.async, false);
    });

    it('should accept FIFO queue configuration', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue.fifo',
        region: 'us-east-1',
        message: {
          body: 'FIFO message',
          messageGroupId: 'group-1',
          messageDeduplicationId: 'dedup-1',
        },
      };

      assert.strictEqual(config.message.messageGroupId, 'group-1');
      assert.strictEqual(config.message.messageDeduplicationId, 'dedup-1');
    });

    it('should accept message with delay seconds', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        message: {
          body: 'Delayed message',
          delaySeconds: 60,
        },
      };

      assert.strictEqual(config.message.delaySeconds, 60);
    });

    it('should accept message with attributes', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        message: {
          body: 'Message with attributes',
          messageAttributes: {
            correlationId: {
              DataType: 'String',
              StringValue: 'corr-123',
            },
            priority: {
              DataType: 'Number',
              StringValue: '1',
            },
          },
        },
      };

      assert.strictEqual(
        config.message.messageAttributes?.correlationId?.DataType,
        'String'
      );
    });

    it('should accept fallback configuration', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        message: {
          body: 'Test message',
        },
        fallback: {
          status: 200,
          data: { fallback: true, queued: false },
        },
      };

      assert.strictEqual(config.fallback?.status, 200);
      assert.deepStrictEqual(config.fallback?.data, { fallback: true, queued: false });
    });

    it('should accept JSON object as message body', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        message: {
          body: { userId: 1, action: 'create', timestamp: new Date().toISOString() },
        },
      };

      assert.strictEqual(typeof config.message.body, 'object');
      assert.strictEqual(config.message.body.userId, 1);
    });

    it('should accept access key credentials with session token', () => {
      const config: SqsServiceConfig = {
        type: 'sqs',
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        region: 'us-east-1',
        credentials: {
          type: 'accessKey',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          sessionToken: 'AQoDYXdzEJr...',
        },
        message: {
          body: 'Test message',
        },
      };

      assert.strictEqual(config.credentials?.type, 'accessKey');
      if (config.credentials?.type === 'accessKey') {
        assert.strictEqual(config.credentials.sessionToken, 'AQoDYXdzEJr...');
      }
    });
  });
});
