import type { BaseServiceConfig } from '@flow-stack/core';

/**
 * REST service configuration
 */
export interface RestServiceConfig extends BaseServiceConfig {
  type: 'rest';
  url: string;
  method: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  timeout?: number;
  oidc?: {
    clientId: string;
    clientSecret: string;
    scope?: string;
    tokenUrl?: string;
  };
}
