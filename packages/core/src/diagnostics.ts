import { channel } from 'node:diagnostics_channel';
import type { BaseServiceConfig, OrchestrationContext } from './types.js';

export const channels = {
  start: channel(`flow-stack:service:start`),
  complete: channel(`flow-stack:service:complete`),
  error: channel(`flow-stack:service:error`)
}

/**
 * Diagnostic channel message - supports any service type
 */
export interface DiagnosticChannelMessage {
  serviceId: string;
  serviceType: string;
  config?: any;
  timestamp: number;
  processingTime?: number;
  error?: {
    message: string;
    code?: string;
  };
  status?: number | null;
  fallbackUsed?: boolean;
}

/**
 * Emit a diagnostic channel event for service start
 */
export function emitServiceStart(
  serviceId: string,
  serviceType: string,
  config: BaseServiceConfig | null,
  context: OrchestrationContext
): void {
  if (channels.start.hasSubscribers) {
    const message: DiagnosticChannelMessage = {
      serviceId,
      serviceType,
      timestamp: Date.now(),
    };

    if (config) {
      // Include config without sensitive data (handler functions, etc.)
      const { fallback, errorStrategy, ...safeConfig } = config;
      message.config = safeConfig;
    }

    channels.start.publish(message);
  }
}

/**
 * Emit a diagnostic channel event for service completion
 */
export function emitServiceComplete(
  serviceId: string,
  serviceType: string,
  config: BaseServiceConfig | null,
  context: OrchestrationContext,
  processingTime: number,
  status: number | null,
  fallbackUsed?: boolean
): void {
  if (channels.complete.hasSubscribers) {
    const message: DiagnosticChannelMessage = {
      serviceId,
      serviceType,
      timestamp: Date.now(),
      processingTime,
      status,
      fallbackUsed,
    };

    if (config) {
      const { fallback, errorStrategy, ...safeConfig } = config;
      message.config = safeConfig;
    }

    channels.complete.publish(message);
  }
}

/**
 * Emit a diagnostic channel event for service error
 */
export function emitServiceError(
  serviceId: string,
  serviceType: string,
  config: BaseServiceConfig | null,
  context: OrchestrationContext,
  processingTime: number,
  error: any
): void {
  if (channels.error.hasSubscribers) {
    const message: DiagnosticChannelMessage = {
      serviceId,
      serviceType,
      timestamp: Date.now(),
      processingTime,
      error: {
        message: error.message || String(error),
        code: error.code,
      },
    };

    if (config) {
      const { fallback, errorStrategy, ...safeConfig } = config;
      message.config = safeConfig;
    }

    channels.error.publish(message);
  }
}
