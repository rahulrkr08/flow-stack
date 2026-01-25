# @workflow-stack/sqs

AWS SQS plugin for @workflow-stack/core - SQS message publishing orchestration using AWS SDK v3.

## Installation

```bash
npm install @workflow-stack/core @workflow-stack/sqs
```

## Quick Start

```javascript
import { runOrchestration, registerPlugin } from '@workflow-stack/core';
import { sqsPlugin } from '@workflow-stack/sqs';

// Register the SQS plugin
registerPlugin(sqsPlugin);

const services = [
  {
    id: 'sendMessage',
    service: {
      type: 'sqs',
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
      region: 'us-east-1',
      message: {
        body: { userId: '{request.body.userId}', event: 'signup' }
      }
    }
  }
];

const result = await runOrchestration(services, {
  request: { body: { userId: '123' } }
});
```

## SQS Service Configuration

```typescript
interface SqsServiceConfig {
  type: 'sqs';
  queueUrl: string;
  region: string;
  credentials?: SqsAccessKeyCredentials | SqsAssumeRoleCredentials;
  message: {
    body: any;
    messageGroupId?: string;
    messageDeduplicationId?: string;
    delaySeconds?: number;
    messageAttributes?: Record<string, SqsMessageAttribute>;
  };
  retry?: {
    maxAttempts?: number;
    retryMode?: 'standard' | 'adaptive';
  };
  async?: boolean;
  fallback?: {
    status?: number | null;
    data: any;
  };
  errorStrategy?: 'silent' | 'throw';
}
```

## Authentication

### Using Access Key Credentials

```javascript
{
  id: 'sendMessage',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
    region: 'us-east-1',
    credentials: {
      type: 'accessKey',
      accessKeyId: '{env.AWS_ACCESS_KEY_ID}',
      secretAccessKey: '{env.AWS_SECRET_ACCESS_KEY}',
      sessionToken: '{env.AWS_SESSION_TOKEN}' // optional
    },
    message: {
      body: 'Hello World'
    }
  }
}
```

### Using Assume Role

```javascript
{
  id: 'sendMessage',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
    region: 'us-east-1',
    credentials: {
      type: 'assumeRole',
      roleArn: 'arn:aws:iam::123456789012:role/SQSPublisherRole',
      roleSessionName: 'flow-stack-session', // optional
      externalId: 'external-id', // optional
      durationSeconds: 3600 // optional
    },
    message: {
      body: 'Hello World'
    }
  }
}
```

### Using Default Credential Chain

If no credentials are specified, the AWS SDK default credential chain is used (environment variables, shared credentials file, EC2 instance profile, etc.).

```javascript
{
  id: 'sendMessage',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
    region: 'us-east-1',
    message: {
      body: 'Hello World'
    }
  }
}
```

## Examples

### Basic Message

```javascript
{
  id: 'notify',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/notifications',
    region: 'us-east-1',
    message: {
      body: {
        userId: '{request.body.userId}',
        action: 'user_created',
        timestamp: '{request.body.timestamp}'
      }
    }
  }
}
```

### FIFO Queue

```javascript
{
  id: 'orderEvent',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/orders.fifo',
    region: 'us-east-1',
    message: {
      body: { orderId: '{request.body.orderId}', status: 'placed' },
      messageGroupId: '{request.body.orderId}',
      messageDeduplicationId: '{request.body.eventId}'
    }
  }
}
```

### Delayed Message

```javascript
{
  id: 'scheduledTask',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/tasks',
    region: 'us-east-1',
    message: {
      body: { task: 'send_reminder', userId: '123' },
      delaySeconds: 300 // 5 minutes delay
    }
  }
}
```

### Message with Attributes

```javascript
{
  id: 'eventWithMetadata',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/events',
    region: 'us-east-1',
    message: {
      body: { event: 'user_signup' },
      messageAttributes: {
        correlationId: {
          DataType: 'String',
          StringValue: '{request.headers.x-correlation-id}'
        },
        priority: {
          DataType: 'Number',
          StringValue: '1'
        }
      }
    }
  }
}
```

### With Retry Configuration

```javascript
{
  id: 'reliableMessage',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/critical',
    region: 'us-east-1',
    message: {
      body: { event: 'payment_processed' }
    },
    retry: {
      maxAttempts: 5,
      retryMode: 'adaptive'
    }
  }
}
```

### Async (Fire-and-Forget) Mode

```javascript
{
  id: 'asyncNotification',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/notifications',
    region: 'us-east-1',
    message: {
      body: { event: 'page_viewed' }
    },
    async: true // Returns immediately without waiting for SQS response
  }
}
```

### With Fallback

```javascript
{
  id: 'messageWithFallback',
  service: {
    type: 'sqs',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
    region: 'us-east-1',
    message: {
      body: { event: 'user_action' }
    },
    fallback: {
      status: 200,
      data: { queued: false, reason: 'SQS unavailable' }
    }
  }
}
```

### Using Dependencies

```javascript
const services = [
  {
    id: 'createOrder',
    service: {
      type: 'rest',
      url: 'https://api.example.com/orders',
      method: 'POST',
      body: { items: '{request.body.items}' }
    }
  },
  {
    id: 'notifyWarehouse',
    dependsOn: ['createOrder'],
    service: {
      type: 'sqs',
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/warehouse',
      region: 'us-east-1',
      message: {
        body: {
          orderId: '{createOrder.body.id}',
          action: 'prepare_shipment'
        }
      }
    }
  }
];
```

## Sync vs Async Mode

| Mode | `async` | Behavior | Response |
|------|---------|----------|----------|
| Sync (default) | `false` or omitted | Waits for SQS response | `{ status: 200, body: { messageId, sequenceNumber? } }` |
| Async | `true` | Returns immediately | `{ status: 202, body: { message: 'Message queued for delivery', async: true } }` |

## Response Structure

### Successful Response (Sync)

```typescript
{
  status: 200,
  body: {
    messageId: 'abc123-def456-...',
    sequenceNumber: '12345...' // Only for FIFO queues
  },
  metadata: {
    executionStatus: 'executed',
    serviceType: 'sqs'
  }
}
```

### Successful Response (Async)

```typescript
{
  status: 202,
  body: {
    message: 'Message queued for delivery',
    async: true
  },
  metadata: {
    executionStatus: 'executed',
    serviceType: 'sqs'
  }
}
```

### Error Response

```typescript
{
  status: null,
  body: null,
  error: {
    message: 'Access Denied',
    code: 'AccessDeniedException'
  },
  metadata: {
    executionStatus: 'failed',
    serviceType: 'sqs'
  }
}
```

## TypeScript Support

```typescript
import type {
  SqsServiceConfig,
  SqsCredentials,
  SqsAccessKeyCredentials,
  SqsAssumeRoleCredentials,
  SqsRetryConfig,
  SqsMessageAttribute
} from '@workflow-stack/sqs';

import { sqsPlugin, executeSqsService } from '@workflow-stack/sqs';
```

## License

MIT
