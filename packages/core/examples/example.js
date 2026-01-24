/**
 * @workflow-stack/core Example
 *
 * This example demonstrates using custom services in a workflow orchestration.
 * For REST services, use the @workflow-stack/rest plugin.
 */

import { runOrchestration } from '@workflow-stack/core';

// Simulated database for custom handler
const mockDatabase = {
  users: {
    1: { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
    2: { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
  },
  configs: {
    'app-config': { apiUrl: 'https://api.example.com', maxRetries: 3 },
  },
};

// Define services (custom type only - no plugin needed)
const services = [
  // Custom service: Fetch user from database
  {
    id: 'getUser',
    service: {
      type: 'custom',
      handler: async (input, context) => {
        const userId = context.request?.body?.userId;
        const user = mockDatabase.users[userId];

        if (!user) {
          return {
            status: 404,
            body: { error: 'User not found' },
          };
        }

        return {
          status: 200,
          body: user,
        };
      },
    },
  },

  // Custom service: Fetch app config
  {
    id: 'getConfig',
    service: {
      type: 'custom',
      handler: async (input, context) => {
        const config = mockDatabase.configs['app-config'];
        return {
          status: 200,
          body: config,
        };
      },
    },
  },

  // Custom service: Simulate external data fetch
  {
    id: 'fetchExternalData',
    dependsOn: ['getUser', 'getConfig'],
    service: {
      type: 'custom',
      handler: async (input, context) => {
        // Simulate external API call
        return {
          status: 200,
          body: { title: 'Sample Post', content: 'External data fetched' },
        };
      },
      fallback: {
        data: { title: 'Fallback post', body: 'Service unavailable' },
      },
    },
  },

  // Custom service: Process all results
  {
    id: 'processResults',
    dependsOn: ['getUser', 'getConfig', 'fetchExternalData'],
    service: {
      type: 'custom',
      handler: async (input, context) => {
        const user = context.getUser?.body;
        const config = context.getConfig?.body;
        const externalData = context.fetchExternalData?.body;

        return {
          status: 200,
          body: {
            summary: {
              userName: user?.name,
              userRole: user?.role,
              configMaxRetries: config?.maxRetries,
              externalPostTitle: externalData?.title,
            },
            processedAt: new Date().toISOString(),
          },
        };
      },
    },
  },
];

// Run orchestration
async function main() {
  console.log('Running @workflow-stack/core orchestration...\n');

  const context = {
    request: {
      body: { userId: 1 },
    },
    env: {
      NODE_ENV: 'development',
    },
  };

  try {
    const result = await runOrchestration(services, context);

    console.log('=== Results ===\n');

    for (const [serviceId, serviceResult] of Object.entries(result.services)) {
      console.log(`Service: ${serviceId}`);
      console.log(`  Status: ${serviceResult.status}`);
      console.log(`  Type: ${serviceResult.metadata?.serviceType || 'unknown'}`);
      console.log(`  Execution: ${serviceResult.metadata?.executionStatus}`);
      console.log(`  Body:`, JSON.stringify(serviceResult.body, null, 4));
      console.log('');
    }
  } catch (error) {
    console.error('Orchestration failed:', error);
  }
}

main();
