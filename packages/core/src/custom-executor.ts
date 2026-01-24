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
    // Execute the custom handler with input and context
    const result = await config.handler(
      {
        serviceId,
        context,
      },
      context
    );

    // Ensure result has required fields
    const normalizedResult: ServiceResult = {
      status: result.status ?? null,
      body: result.body,
      headers: result.headers,
      cookies: result.cookies,
      error: result.error,
      metadata: {
        ...result.metadata,
        executionStatus: result.metadata?.executionStatus || 'executed',
        serviceType: 'custom',
      },
    };

    const processingTime = Date.now() - startTime;
    emitServiceComplete(serviceId, 'custom', null, context, processingTime, normalizedResult.status);

    return normalizedResult;
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
