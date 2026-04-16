import { request as undiciRequest, interceptors, Agent } from 'undici';
import type { ServiceResult, OrchestrationContext } from '@workflow-stack/core';
import { emitServiceStart, emitServiceComplete, emitServiceError } from '@workflow-stack/core';
import type { RestServiceConfig } from './types.js';

/**
 * Executes a single REST HTTP service call using Undici
 */
export async function executeRestService(
  config: RestServiceConfig,
  context: OrchestrationContext,
  serviceId: string
): Promise<ServiceResult> {
  const startTime = Date.now();

  emitServiceStart(serviceId, 'rest', config, context);

  try {
    // Build URL with query params
    let url = config.url;
    if (config.query && Object.keys(config.query).length > 0) {
      // Filter out undefined, null, and stringified "undefined" or "null" values
      const filteredQuery = Object.fromEntries(
        Object.entries(config.query).filter(([_, value]) =>
          value != null && value !== 'undefined' && value !== 'null'
        )
      );
      if (Object.keys(filteredQuery).length > 0) {
        const params = new URLSearchParams(filteredQuery);
        url = `${url}?${params.toString()}`;
      }
    }

    // Prepare headers
    const headers = new Map<string, string>();
    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    // Add content-type for POST/PUT/PATCH with body
    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase())) {
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }

    // Add cookies to headers
    if (config.cookies && Object.keys(config.cookies).length > 0) {
      const cookieHeader = Object.entries(config.cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      headers.set('cookie', cookieHeader);
    }

    // Prepare request body
    let body: string | undefined;
    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase())) {
      body = JSON.stringify(config.body);
    }

    // Setup request options
    const options: any = {
      method: config.method,
      headers: Object.fromEntries(headers),
      bodyTimeout: config.timeout || 30000,
      headersTimeout: config.timeout || 30000,
    };

    if (body) {
      options.body = body;
    }

    // Collect interceptors to compose. If any are present, compose them onto a
    // fresh Agent so they have a real undici Dispatcher to work with (the global
    // dispatcher may be a mock in test environments).
    const composedInterceptors: any[] = [];

    if (config.oidc) {
      // @ts-expect-error types missing
      const { createOidcInterceptor } = await import('undici-oidc-interceptor');
      // urls tells the interceptor which origins to attach the Bearer token to.
      // Default to the origin of the request URL so no extra config is needed.
      const targetOrigin = new URL(config.url).origin;
      composedInterceptors.push(createOidcInterceptor({
        clientId: config.oidc.clientId,
        clientSecret: config.oidc.clientSecret,
        scope: config.oidc.scope,
        idpTokenUrl: config.oidc.idpTokenUrl,
        urls: config.oidc.urls ?? [targetOrigin],
      }));
    }

    if (config.cacheStore) {
      composedInterceptors.push(interceptors.cache({ store: config.cacheStore as any }));
    }

    if (composedInterceptors.length > 0) {
      options.dispatcher = new Agent().compose(composedInterceptors);
    }

    // Execute HTTP request
    const response = await undiciRequest(url, options);

    // Parse response body
    let parsedBody: any;
    const contentType = response.headers['content-type'];
    const mediaType = typeof contentType === 'string' ? contentType.split(';')[0].trim() : '';

    // Determine if response is binary media (image, video, audio, etc.)
    const binaryMediaTypes = [
      'image/',
      'video/',
      'audio/',
      'application/octet-stream',
      'application/pdf',
      'application/zip',
      'application/gzip',
    ];
    const isBinaryMedia = binaryMediaTypes.some((type) => mediaType.startsWith(type));

    if (mediaType.includes('application/json')) {
      const text = await response.body.text();
      parsedBody = text ? JSON.parse(text) : null;
    } else if (isBinaryMedia) {
      parsedBody = Buffer.from(await response.body.arrayBuffer());
    } else {
      // For text-based responses (plain text, html, xml, etc.)
      parsedBody = await response.body.text();
    }

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === 'string') {
        responseHeaders[key] = value;
      } else if (Array.isArray(value)) {
        responseHeaders[key] = value.join(', ');
      }
    }

    // Extract cookies from Set-Cookie header
    const responseCookies: Record<string, string> = {};
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const cookie of cookies) {
        const match = cookie.match(/^([^=]+)=([^;]+)/);
        if (match) {
          responseCookies[match[1]] = match[2];
        }
      }
    }

    const processingTime = Date.now() - startTime;
    emitServiceComplete(serviceId, 'rest', config, context, processingTime, response.statusCode);

    return {
      status: response.statusCode,
      body: parsedBody,
      headers: responseHeaders,
      cookies: responseCookies,
      metadata: {
        executionStatus: 'executed',
        serviceType: 'rest',
      },
    };
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    emitServiceError(serviceId, 'rest', config, context, processingTime, error);

    // If fallback is configured, return it
    if (config.fallback) {
      return {
        status: config.fallback.status || null,
        body: config.fallback.data,
        metadata: {
          executionStatus: 'failed',
          fallbackUsed: true,
          serviceType: 'rest',
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
        serviceType: 'rest',
      },
    };
  }
}
