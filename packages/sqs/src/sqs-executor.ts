import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import type { ServiceResult, OrchestrationContext } from '@workflow-stack/core';
import { emitServiceStart, emitServiceComplete, emitServiceError } from '@workflow-stack/core';
import type { SqsServiceConfig, SqsAssumeRoleCredentials } from './types.js';

/**
 * Creates an SQS client based on the provided configuration
 */
function createSqsClient(config: SqsServiceConfig): SQSClient {
  const clientConfig: any = {
    region: config.region,
  };

  if (config.retry) {
    clientConfig.maxAttempts = config.retry.maxAttempts;
    clientConfig.retryMode = config.retry.retryMode;
  }

  if (config.credentials) {
    if (config.credentials.type === 'accessKey') {
      clientConfig.credentials = {
        accessKeyId: config.credentials.accessKeyId,
        secretAccessKey: config.credentials.secretAccessKey,
        sessionToken: config.credentials.sessionToken,
      };
    } else if (config.credentials.type === 'assumeRole') {
      const roleConfig = config.credentials as SqsAssumeRoleCredentials;
      clientConfig.credentials = fromTemporaryCredentials({
        params: {
          RoleArn: roleConfig.roleArn,
          RoleSessionName: roleConfig.roleSessionName || 'flow-stack-sqs-session',
          ExternalId: roleConfig.externalId,
          DurationSeconds: roleConfig.durationSeconds,
        },
      });
    }
  }

  return new SQSClient(clientConfig);
}

/**
 * Executes SQS message publishing
 */
async function sendMessage(
  client: SQSClient,
  config: SqsServiceConfig
): Promise<{ messageId: string; sequenceNumber?: string }> {
  const messageBody =
    typeof config.message.body === 'string'
      ? config.message.body
      : JSON.stringify(config.message.body);

  const command = new SendMessageCommand({
    QueueUrl: config.queueUrl,
    MessageBody: messageBody,
    MessageGroupId: config.message.messageGroupId,
    MessageDeduplicationId: config.message.messageDeduplicationId,
    DelaySeconds: config.message.delaySeconds,
    MessageAttributes: config.message.messageAttributes,
  });

  const response = await client.send(command);

  return {
    messageId: response.MessageId!,
    sequenceNumber: response.SequenceNumber,
  };
}

/**
 * Executes a single SQS publish service call
 */
export async function executeSqsService(
  config: SqsServiceConfig,
  context: OrchestrationContext,
  serviceId: string
): Promise<ServiceResult> {
  const startTime = Date.now();

  emitServiceStart(serviceId, 'sqs', config, context);

  const client = createSqsClient(config);

  try {
    const isAsync = config.async === true;

    if (isAsync) {
      // Fire and forget - don't wait for response
      sendMessage(client, config).catch((error) => {
        // Log error but don't fail the service
        const processingTime = Date.now() - startTime;
        emitServiceError(serviceId, 'sqs', config, context, processingTime, error);
      });

      const processingTime = Date.now() - startTime;
      emitServiceComplete(serviceId, 'sqs', config, context, processingTime, 202);

      return {
        status: 202,
        body: {
          message: 'Message queued for delivery',
          async: true,
        },
        metadata: {
          executionStatus: 'executed',
          serviceType: 'sqs',
        },
      };
    }

    // Sync mode - wait for response
    const result = await sendMessage(client, config);

    const processingTime = Date.now() - startTime;
    emitServiceComplete(serviceId, 'sqs', config, context, processingTime, 200);

    return {
      status: 200,
      body: {
        messageId: result.messageId,
        sequenceNumber: result.sequenceNumber,
      },
      metadata: {
        executionStatus: 'executed',
        serviceType: 'sqs',
      },
    };
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    emitServiceError(serviceId, 'sqs', config, context, processingTime, error);

    // If fallback is configured, return it
    if (config.fallback) {
      return {
        status: config.fallback.status || null,
        body: config.fallback.data,
        metadata: {
          executionStatus: 'failed',
          fallbackUsed: true,
          serviceType: 'sqs',
        },
      };
    }

    // Otherwise, return error
    return {
      status: null,
      body: null,
      error: {
        message: error.message,
        code: error.code || error.name,
      },
      metadata: {
        executionStatus: 'failed',
        serviceType: 'sqs',
      },
    };
  } finally {
    client.destroy();
  }
}
