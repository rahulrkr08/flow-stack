import { executeWorkflow, Process } from 'async-flow-orchestrator';
import type {
  ServiceBlock,
  OrchestrationContext,
  OrchestrationResult,
  ServiceResult,
  CustomServiceConfig,
  BaseServiceConfig,
} from './types.js';
import { interpolateObject } from './interpolation.js';
import { executeCustomService } from './custom-executor.js';
import { getPlugin } from './plugin-registry.js';

/**
 * Main orchestration function
 * Executes services in dependency order with variable interpolation
 * Supports 'custom' type by default and any registered plugin types
 */
export async function runOrchestration(
  services: ServiceBlock[],
  context: OrchestrationContext
): Promise<OrchestrationResult> {
  // Build processes array for async-flow-orchestrator
  const processes: Process[] = services.map(serviceBlock => ({
    id: serviceBlock.id,
    dependencies: serviceBlock.dependsOn || [],
    execute: async (workflowContext) => {
      const currentContext = workflowContext.getAll() as OrchestrationContext;
      const serviceConfig = serviceBlock.service;

      let result: ServiceResult;

      if (serviceConfig.type === 'custom') {
        // Built-in custom type - handler function
        result = await executeCustomService(
          serviceConfig as CustomServiceConfig,
          currentContext,
          serviceBlock.id
        );
      } else {
        // Check for registered plugin
        const plugin = getPlugin(serviceConfig.type);

        if (plugin) {
          try {
            // Interpolate config if plugin wants it (default: true)
            let configToExecute: BaseServiceConfig = serviceConfig;
            if (plugin.interpolate !== false) {
              configToExecute = await interpolateObject(serviceConfig, currentContext);
            }

            // Execute using plugin
            result = await plugin.execute(
              configToExecute,
              currentContext,
              serviceBlock.id
            );
          } catch (error: any) {
            // Plugin threw an error - return error result
            if (serviceConfig.fallback) {
              result = {
                status: serviceConfig.fallback.status || null,
                body: serviceConfig.fallback.data,
                metadata: {
                  executionStatus: 'failed',
                  fallbackUsed: true,
                  serviceType: serviceConfig.type,
                },
              };
            } else {
              result = {
                status: null,
                body: null,
                error: {
                  message: error.message,
                  code: error.code,
                },
                metadata: {
                  executionStatus: 'failed',
                  serviceType: serviceConfig.type,
                },
              };
            }
          }
        } else {
          // Unknown service type - return error
          result = {
            status: null,
            body: null,
            error: {
              message: `Unknown service type: '${serviceConfig.type}'. Did you forget to register a plugin?`,
            },
            metadata: {
              executionStatus: 'failed',
              serviceType: serviceConfig.type,
            },
          };
        }
      }

      // If service failed and errorStrategy is 'throw', throw error to stop dependent services
      const errorStrategy = serviceBlock.errorStrategy || serviceConfig.errorStrategy || 'silent';
      if (errorStrategy === 'throw' && (result.metadata?.executionStatus === 'failed' || result.error)) {
        const err = new Error(`Service ${serviceBlock.id} failed`);
        // Include the service result (including error details) for debugging
        (err as any).result = result;
        throw err;
      }

      return result;
    },
    condition: serviceBlock.condition,
    errorStrategy: serviceBlock.errorStrategy || serviceBlock.service.errorStrategy || 'silent',
  }));

  let workflowResult: any = await executeWorkflow({
    processes,
    initialContext: context,
  });

  // Extract service results from workflow data
  const servicesMap: Record<string, ServiceResult> = {};

  for (const serviceBlock of services) {
    const status = workflowResult.metadata?.states?.[serviceBlock.id];
    // Data can be in workflowResult.data (normal case) or in context (when execute threw)
    let data = workflowResult.data?.[serviceBlock.id];

    switch (status) {
      case 'completed':
        // Service completed successfully
        servicesMap[serviceBlock.id] = data as ServiceResult;
        break;

      case 'failed':
        // Service failed - the result should be in data or context
        const errorResult = workflowResult.metadata?.errors?.[serviceBlock.id];
        const { result: { metadata, ...error } = { metadata: undefined } } = errorResult || {};
        if (errorResult) {
          servicesMap[serviceBlock.id] = {
            error,
            status: errorResult.result?.status || null,
            body: errorResult.result?.body || null,
            metadata: metadata,
          } as ServiceResult;
        }
        break;

      case 'skipped':
        servicesMap[serviceBlock.id] = {
          status: serviceBlock.service.fallback?.status || null,
          body: serviceBlock.service.fallback?.data,
          metadata: {
            executionStatus: 'skipped',
            fallbackUsed: !!serviceBlock.service.fallback,
          },
        };
        break;

      case 'pending':
        // Service was not executed due to failed dependencies
        servicesMap[serviceBlock.id] = {
          status: null,
          body: null,
          metadata: {
            executionStatus: 'pending',
          },
        };
        break;
    }
  }

  return {
    context,
    services: servicesMap,
  };
}
