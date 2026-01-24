import type { FlowStackPlugin } from '@flow-stack/core';
import type { RestServiceConfig } from './types.js';
import { executeRestService } from './rest-executor.js';

/**
 * REST plugin for flow-stack
 * Provides HTTP service execution using Undici
 */
export const restPlugin: FlowStackPlugin<RestServiceConfig> = {
  type: 'rest',
  name: '@flow-stack/rest',
  version: '1.0.0',
  execute: executeRestService,
  interpolate: true,
};
