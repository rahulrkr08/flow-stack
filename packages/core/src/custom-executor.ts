import type { CustomServiceConfig, ServiceResult, OrchestrationContext } from './types.js';
import { emitServiceStart, emitServiceComplete, emitServiceError } from './diagnostics.js';

/**
 * Executes a custom service using the provided handler function
 */
export async function executeCustomService(
  config: CustomServiceConfig,
  context: OrchestrationContext,
  serviceId: string
): Promise<ServiceResult> {
  const startTime = Date.now();

  emitServiceStart(serviceId, 'custom', null, context);

  try {
    // Execute the custom handler with context only
    const result = await config.handler(context);

    const processingTime = Date.now() - startTime;
    emitServiceComplete(serviceId, 'custom', null, context, processingTime, result.status);

    return result;
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    emitServiceError(serviceId, 'custom', null, context, processingTime, error);

    // If fallback is configured, return it
    if (config.fallback) {
      return {
        status: config.fallback.status || null,
        body: config.fallback.data,
        metadata: {
          executionStatus: 'failed',
          fallbackUsed: true,
          serviceType: 'custom',
        },
      };
    }

    // Otherwise, return error
    return {
      status: null,
      body: null,
      error: {
        message: error.message,
        code: error.code,
      },
      metadata: {
        executionStatus: 'failed',
        serviceType: 'custom',
      },
    };
  }
}
