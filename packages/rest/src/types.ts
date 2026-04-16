import type { BaseServiceConfig } from '@workflow-stack/core';

/**
 * Minimal interface for a cache store compatible with undici's cache interceptor.
 * Matches the CacheStore interface expected by undici's interceptors.cache().
 *
 * Use RedisCacheStore from undici-cache-redis as the implementation:
 *   import { RedisCacheStore } from 'undici-cache-redis'
 *
 * Or use undici's built-in MemoryCacheStore for testing:
 *   import undici from 'undici'
 *   const store = new undici.cacheStores.MemoryCacheStore()
 */
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
  oidc?: {
    clientId: string;
    clientSecret: string;
    idpTokenUrl: string;
    scope?: string;
    urls?: string[];
  };
  /**
   * Cache store for HTTP response caching via undici's cache interceptor.
   * Use RedisCacheStore from undici-cache-redis:
   *   import { RedisCacheStore } from 'undici-cache-redis'
   *   const store = new RedisCacheStore({ clientOpts: { host: 'localhost', port: 6379 } })
   */
  cacheStore?: CacheStore;
}
