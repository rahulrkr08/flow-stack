/**
 * @workflow-stack/rest Plugin Example
 *
 * This example demonstrates using the REST plugin with @workflow-stack/core
 * to orchestrate HTTP services alongside custom handlers.
 */

import { runOrchestration, registerPlugin } from '@workflow-stack/core';
import { restPlugin } from '@workflow-stack/rest';

// Register the REST plugin
registerPlugin(restPlugin);

// Define services
const services = [
  // Custom service: Prepare authentication
  {
    id: 'prepareAuth',
    service: {
      type: 'custom',
      handler: async (input, context) => {
        // In a real app, this might fetch credentials from a secure store
        return {
          status: 200,
          body: {
            apiKey: 'demo-api-key-123',
            baseUrl: 'https://jsonplaceholder.typicode.com',
          },
        };
      },
    },
  },

  // REST service: Fetch user data from external API
  {
    id: 'fetchUser',
    dependsOn: ['prepareAuth'],
    service: {
      type: 'rest',
      url: '{prepareAuth.body.baseUrl}/users/1',
      method: 'GET',
      headers: {
        'X-API-Key': '{prepareAuth.body.apiKey}',
      },
      timeout: 5000,
      fallback: {
        status: 200,
        data: { name: 'Fallback User', email: 'fallback@example.com' },
      },
    },
  },

  // REST service: Fetch user's posts
  {
    id: 'fetchPosts',
    dependsOn: ['fetchUser'],
    service: {
      type: 'rest',
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'GET',
      query: {
        userId: '{fetchUser.body.id}',
        _limit: '3',
      },
    },
  },

  // Custom service: Process and combine results
  {
    id: 'processResults',
    dependsOn: ['fetchUser', 'fetchPosts'],
    service: {
      type: 'custom',
      handler: async (input, context) => {
        const user = context.fetchUser?.body;
        const posts = context.fetchPosts?.body || [];

        return {
          status: 200,
          body: {
            user: {
              name: user?.name,
              email: user?.email,
              company: user?.company?.name,
            },
            postsCount: posts.length,
            postTitles: posts.map(p => p.title),
            fetchedAt: new Date().toISOString(),
          },
        };
      },
    },
  },
];

// Run orchestration
async function main() {
  console.log('Running @workflow-stack/core with @workflow-stack/rest plugin...\n');

  const context = {
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

      if (serviceId === 'processResults') {
        console.log(`  Body:`, JSON.stringify(serviceResult.body, null, 4));
      } else {
        console.log(`  Body: [truncated for readability]`);
      }
      console.log('');
    }
  } catch (error) {
    console.error('Orchestration failed:', error);
  }
}

main();
