# flow-stack

A plugin-based workflow engine that orchestrates services with custom handlers and extensible plugins.

## Monorepo Structure

This repository is organized as a monorepo using Lerna and npm workspaces:

| Package | Description |
|---------|-------------|
| [@flow-stack/core](./packages/core) | Core orchestration engine with built-in `custom` service type |
| [@flow-stack/rest](./packages/rest) | REST/HTTP plugin using Undici |

## Features

- **Plugin Architecture**: Extensible system for adding new service types
- **Custom Services**: Built-in support for custom handlers (databases, file systems, queues, etc.)
- **Dependency Management**: Automatic topological sorting ensures services execute in correct order
- **Parallel Execution**: Independent services run in parallel for optimal performance
- **JSONata Interpolation**: Powerful expression syntax for dynamic configuration
- **Type Preservation**: Single token expressions preserve their original types
- **Conditional Execution**: Skip services based on runtime conditions
- **Error Handling**: Silent or throw strategies with fallback support
- **Diagnostic Channels**: Node.js diagnostic channels for monitoring and debugging

## Installation

```bash
# Core package only (custom services)
npm install @flow-stack/core

# With REST plugin
npm install @flow-stack/core @flow-stack/rest
```

## Quick Start

### Custom Service (Built-in)

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

### Using Plugins (REST Example)

```javascript
import { runOrchestration, registerPlugin } from '@flow-stack/core';
import { restPlugin } from '@flow-stack/rest';

// Register the REST plugin
registerPlugin(restPlugin);

const services = [
  {
    id: 'fetchUser',
    service: {
      type: 'rest',
      url: 'https://api.example.com/users/1',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer {env.API_TOKEN}'
      }
    }
  }
];

const result = await runOrchestration(services, {
  env: { API_TOKEN: 'your-token' }
});
```

### Mixed Services with Dependencies

```javascript
import { runOrchestration, registerPlugin } from '@flow-stack/core';
import { restPlugin } from '@flow-stack/rest';

registerPlugin(restPlugin);

const services = [
  // Custom service: Read configuration from database
  {
    id: 'getConfig',
    service: {
      type: 'custom',
      handler: async (input, context) => {
        const config = await database.findConfig(context.request.body.configId);
        return { status: 200, body: config };
      }
    }
  },

  // REST service: Fetch data using config
  {
    id: 'fetchExternalData',
    dependsOn: ['getConfig'],
    service: {
      type: 'rest',
      url: '{getConfig.body.apiUrl}/data',
      method: 'GET',
      headers: {
        'X-API-Key': '{getConfig.body.apiKey}'
      }
    }
  },

  // Custom service: Process and store results
  {
    id: 'processResults',
    dependsOn: ['fetchExternalData'],
    service: {
      type: 'custom',
      handler: async (input, context) => {
        const externalData = context.fetchExternalData.body;
        await database.save(externalData);
        return { status: 200, body: { saved: true } };
      }
    }
  }
];

const result = await runOrchestration(services, {
  request: { body: { configId: 'config-123' } }
});
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm test

# Run tests for specific package
npm test --workspace=@flow-stack/core
npm test --workspace=@flow-stack/rest
```

## Documentation

- [@flow-stack/core README](./packages/core/README.md) - Full API documentation
- [@flow-stack/rest README](./packages/rest/README.md) - REST plugin documentation

## License

MIT

## Related

- [undici-workflow-engine](https://github.com/rahulrkr08/undici-workflow-engine) - REST-only workflow engine
- [async-flow-orchestrator](https://github.com/rahulrkr08/async-flow-orchestrator) - Dependency orchestration library
- [jsonata](https://jsonata.org/) - JSON query and transformation language
