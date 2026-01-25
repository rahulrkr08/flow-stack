import type { BaseServiceConfig } from '@workflow-stack/core';

/**
 * AWS credentials configuration using access key and secret
 */
export interface SqsAccessKeyCredentials {
  type: 'accessKey';
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

/**
 * AWS credentials configuration using assume role
 */
export interface SqsAssumeRoleCredentials {
  type: 'assumeRole';
  roleArn: string;
  roleSessionName?: string;
  externalId?: string;
  durationSeconds?: number;
}

/**
 * AWS credentials - either access key or assume role
 */
export type SqsCredentials = SqsAccessKeyCredentials | SqsAssumeRoleCredentials;

/**
 * Retry configuration for SQS operations
 */
export interface SqsRetryConfig {
  maxAttempts?: number;
  retryMode?: 'standard' | 'adaptive';
}

/**
 * SQS message attributes
 */
export interface SqsMessageAttribute {
  DataType: 'String' | 'Number' | 'Binary';
  StringValue?: string;
  BinaryValue?: Uint8Array;
}

/**
 * SQS service configuration
 */
export interface SqsServiceConfig extends BaseServiceConfig {
  type: 'sqs';
  queueUrl: string;
  region: string;
  credentials?: SqsCredentials;
  message: {
    body: any;
    messageGroupId?: string;
    messageDeduplicationId?: string;
    delaySeconds?: number;
    messageAttributes?: Record<string, SqsMessageAttribute>;
  };
  retry?: SqsRetryConfig;
  async?: boolean;
}
