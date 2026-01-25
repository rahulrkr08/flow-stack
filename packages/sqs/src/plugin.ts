import type { FlowStackPlugin } from '@workflow-stack/core';
import type { SqsServiceConfig } from './types.js';
import { executeSqsService } from './sqs-executor.js';

/**
 * SQS plugin for flow-stack
 * Provides AWS SQS message publishing using AWS SDK v3
 */
export const sqsPlugin: FlowStackPlugin<SqsServiceConfig> = {
  type: 'sqs',
  name: '@workflow-stack/sqs',
  version: '1.0.0',
  execute: executeSqsService,
  interpolate: true,
};
