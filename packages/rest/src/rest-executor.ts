import { request as undiciRequest, interceptors, getGlobalDispatcher } from 'undici';
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

    if (config.cacheStore) {
      options.dispatcher = getGlobalDispatcher().compose(
        interceptors.cache({ store: config.cacheStore as any })
      );
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
    emitServiceComplete(serviceId, 'rest', config, processingTime, response.statusCode, undefined, context);

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
    emitServiceError(serviceId, 'rest', config, processingTime, error, context);

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
