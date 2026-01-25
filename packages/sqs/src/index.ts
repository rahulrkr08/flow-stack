// SQS plugin
export { sqsPlugin } from './plugin.js';

// SQS executor (for advanced use cases)
export { executeSqsService } from './sqs-executor.js';

// Type definitions
export type {
  SqsServiceConfig,
  SqsCredentials,
  SqsAccessKeyCredentials,
  SqsAssumeRoleCredentials,
  SqsRetryConfig,
  SqsMessageAttribute,
} from './types.js';
