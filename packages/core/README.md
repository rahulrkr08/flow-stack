# @flow-stack/core

Core orchestration engine for flow-stack with built-in support for custom handlers and extensible plugin architecture.

## Installation

```bash
npm install @flow-stack/core
```

## Quick Start

```javascript
import { runOrchestration } from '@flow-stack/core';

const services = [
  {
    id: 'readFromDatabase',
    service: {
      type: 'custom',
      handler: async (input, context) => {
        const data = await myDatabase.query('SELECT * FROM users WHERE id = ?', [
          context.request.body.userId
        ]);

        return {
          status: 200,
          body: data
        };
      }
    }
  }
];

const result = await runOrchestration(services, {
  request: { body: { userId: 123 } }
});
```

## Plugin System

### Registering Plugins

```javascript
import { registerPlugin, unregisterPlugin, hasPlugin, getPluginTypes } from '@flow-stack/core';
import { restPlugin } from '@flow-stack/rest';

// Register a plugin
registerPlugin(restPlugin);

// Check if a plugin is registered
if (hasPlugin('rest')) {
  console.log('REST plugin is available');
}

// Get all registered plugin types
console.log(getPluginTypes()); // ['rest']

// Unregister a plugin
unregisterPlugin('rest');
```

### Creating Custom Plugins

```javascript
import { registerPlugin } from '@flow-stack/core';

const myPlugin = {
  type: 'mytype',           // Unique service type identifier
  name: 'my-plugin',        // Human-readable name
  version: '1.0.0',         // Plugin version
  interpolate: true,        // Interpolate config before execution (default: true)
  execute: async (config, context, serviceId) => {
    // Your plugin logic here
    return {
      status: 200,
      body: { result: 'success' },
      metadata: {
        executionStatus: 'executed',
        serviceType: 'mytype'
      }
    };
  }
};

registerPlugin(myPlugin);
```

## Service Configuration

### Custom Service Config

```typescript
interface CustomServiceConfig {
  type: 'custom';
  handler: CustomHandler;
  fallback?: {
    status?: number | null;
    data: any;
  };
  errorStrategy?: 'silent' | 'throw';
}

type CustomHandler = (
  input: CustomHandlerInput,
  context: OrchestrationContext
) => Promise<ServiceResult> | ServiceResult;

interface CustomHandlerInput {
  serviceId: string;
  context: OrchestrationContext;
}
```

### Service Block

```typescript
interface ServiceBlock {
  id: string;                           // Unique identifier
  dependsOn?: string[];                 // IDs of dependent services
  service: ServiceConfig;               // Service configuration
  condition?: (context: any) => boolean; // Skip if returns false
  errorStrategy?: 'silent' | 'throw';
}
```

## Interpolation Syntax

Flow-stack uses JSONata expressions wrapped in curly braces for dynamic configuration.

### Basic Path Access

```javascript
// Access service results
'{authService.body.token}'
'{userService.body.profile.name}'

// Access request context
'{request.body.userId}'
'{request.headers.authorization}'
'{request.cookies.session}'
'{request.query.page}'

// Access environment variables
'{env.API_KEY}'
'{env.BASE_URL}'
```

### Type Preservation

```javascript
// Single token preserves type
userId: '{service.body.id}'        // Returns number
items: '{service.body.items}'      // Returns array
enabled: '{service.body.enabled}'  // Returns boolean

// Mixed text returns string
url: 'https://{env.HOST}/api/{id}' // Returns string
```

### Complex Expressions

```javascript
// JSONata transformations
total: '{$sum(items.(price * qty))}'

// Array mapping with nested braces syntax
ids: '{-$map(items, function($x) { $x.id })-}'

// Backtick notation for special characters
value: '{data.`custom:field`}'
```

## Custom Handler Examples

### Database Operations

```javascript
{
  id: 'queryDatabase',
  service: {
    type: 'custom',
    handler: async (input, context) => {
      const { userId } = context.request.body;

      try {
        const user = await db.users.findById(userId);
        return {
          status: user ? 200 : 404,
          body: user || { error: 'User not found' }
        };
      } catch (error) {
        return {
          status: 500,
          body: null,
          error: { message: error.message }
        };
      }
    }
  }
}
```

### File System Operations

```javascript
{
  id: 'readConfig',
  service: {
    type: 'custom',
    handler: async (input, context) => {
      const fs = await import('fs/promises');
      const configPath = context.env.CONFIG_PATH;

      const content = await fs.readFile(configPath, 'utf-8');
      return {
        status: 200,
        body: JSON.parse(content)
      };
    }
  }
}
```

### Message Queue Operations

```javascript
{
  id: 'publishMessage',
  service: {
    type: 'custom',
    handler: async (input, context) => {
      const { message } = context.request.body;

      await messageQueue.publish('my-topic', {
        payload: message,
        timestamp: Date.now()
      });

      return {
        status: 200,
        body: { published: true }
      };
    }
  }
}
```

## Conditional Execution

```javascript
{
  id: 'conditionalService',
  dependsOn: ['checkPermissions'],
  condition: (context) => {
    const permissions = context.getAll().checkPermissions;
    return permissions?.body?.hasAccess === true;
  },
  service: {
    type: 'custom',
    handler: async () => ({
      status: 200,
      body: { executed: true }
    })
  }
}
```

## Error Handling

### Silent Strategy (Default)

Service fails silently, dependent services can still execute:

```javascript
{
  id: 'optionalService',
  service: {
    type: 'custom',
    handler: async () => { throw new Error('Failed'); },
    errorStrategy: 'silent',
    fallback: {
      data: { default: true }
    }
  }
}
```

### Throw Strategy

Service failure stops dependent services:

```javascript
{
  id: 'criticalService',
  service: {
    type: 'custom',
    handler: async () => { throw new Error('Critical failure'); },
    errorStrategy: 'throw'
  }
}
```

## Diagnostic Channels

Monitor service execution with Node.js diagnostic channels:

```javascript
import { channel } from 'node:diagnostics_channel';

// Service start
channel('flow-stack:service:start').subscribe((message) => {
  console.log(`Service ${message.serviceId} (${message.serviceType}) starting...`);
});

// Service completion
channel('flow-stack:service:complete').subscribe((message) => {
  console.log(`Service ${message.serviceId} completed in ${message.processingTime}ms`);
});

// Service error
channel('flow-stack:service:error').subscribe((message) => {
  console.error(`Service ${message.serviceId} failed: ${message.error.message}`);
});
```

## API Reference

### runOrchestration(services, context)

Main orchestration function.

```typescript
function runOrchestration(
  services: ServiceBlock[],
  context: OrchestrationContext
): Promise<OrchestrationResult>
```

### Plugin Registry Functions

```typescript
// Register a plugin
function registerPlugin<TConfig>(plugin: FlowStackPlugin<TConfig>): void

// Unregister a plugin by type
function unregisterPlugin(type: string): boolean

// Get a plugin by type
function getPlugin<TConfig>(type: string): FlowStackPlugin<TConfig> | undefined

// Check if a plugin is registered
function hasPlugin(type: string): boolean

// Get all registered plugin types
function getPluginTypes(): string[]

// Get all registered plugins
function getPlugins(): FlowStackPlugin[]

// Clear all plugins (useful for testing)
function clearPlugins(): void
```

### executeCustomService(config, context, serviceId)

Execute a single custom service.

```typescript
function executeCustomService(
  config: CustomServiceConfig,
  context: OrchestrationContext,
  serviceId: string
): Promise<ServiceResult>
```

### interpolateObject(obj, context)

Interpolate values in an object using JSONata expressions.

```typescript
function interpolateObject(
  obj: any,
  context: OrchestrationContext
): Promise<any>
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  BaseServiceConfig,
  ServiceConfig,
  CustomServiceConfig,
  CustomHandler,
  CustomHandlerInput,
  ServiceBlock,
  OrchestrationConfig,
  OrchestrationContext,
  ServiceResult,
  ServiceResultMetadata,
  OrchestrationResult,
  FlowStackPlugin,
  PluginExecutor,
} from '@flow-stack/core';
```

## License

MIT
