// Main orchestration function
export { runOrchestration } from './orchestrator.js';

// Plugin registry
export {
  registerPlugin,
  unregisterPlugin,
  getPlugin,
  hasPlugin,
  getPluginTypes,
  getPlugins,
  clearPlugins,
} from './plugin-registry.js';

// Service executor for custom type (built-in)
export { executeCustomService } from './custom-executor.js';

// Utility functions (re-exported from @flow-stack/interpolation)
export {
  interpolateObject,
  cookiesToHeader,
  buildQueryString,
} from '@flow-stack/interpolation';

// Diagnostic channels and emitters
export {
  channels,
  emitServiceStart,
  emitServiceComplete,
  emitServiceError,
} from './diagnostics.js';

// Type definitions
export type {
  BaseServiceConfig,
  ServiceConfig,
  CustomServiceConfig,
  CustomHandler,
  ServiceBlock,
  OrchestrationConfig,
  OrchestrationContext,
  ServiceResult,
  ServiceResultMetadata,
  OrchestrationResult,
  FlowStackPlugin,
  PluginExecutor,
} from './types.js';

export type { DiagnosticChannelMessage } from './diagnostics.js';
