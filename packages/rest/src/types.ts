import type { BaseServiceConfig } from '@workflow-stack/core';

/** Cache store interface compatible with undici's cache interceptor. */
export interface CacheStore {
  get(key: object): Promise<object | undefined> | object | undefined;
  createWriteStream(key: object, value: object): object | undefined;
  delete(key: object): void | Promise<void>;
}

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
  cacheStore?: CacheStore;
}
