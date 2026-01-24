import { describe, it } from 'node:test';
import assert from 'node:assert';
import { executeRestService } from '../src/rest-executor.js';
import {
  MockServer,
  jsonHandler,
  headerValidatingHandler,
  queryParamHandler,
  echoBodyHandler,
  cookieHandler,
  cookieValidatingHandler,
  errorHandler,
} from './helpers.js';

describe('REST Executor', () => {
  describe('GET requests', () => {
    it('should execute a simple GET request', async () => {
      const server = new MockServer(jsonHandler({ id: 1, name: 'test' }));
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/users/1'),
          method: 'GET',
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.deepStrictEqual(result.body, { id: 1, name: 'test' });
        assert.strictEqual(result.metadata?.serviceType, 'rest');
        assert.strictEqual(result.metadata?.executionStatus, 'executed');
      } finally {
        await server.close();
      }
    });

    it('should handle query parameters', async () => {
      const server = new MockServer(queryParamHandler({ page: '1', limit: '10' }));
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/users'),
          method: 'GET',
          query: { page: '1', limit: '10' },
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
      } finally {
        await server.close();
      }
    });

    it('should filter undefined and null query parameters', async () => {
      const server = new MockServer((req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ url: req.url }));
      });
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/test'),
          method: 'GET',
          query: {
            valid: 'value',
            nullValue: 'null',
            undefinedValue: 'undefined',
          },
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.ok(!result.body.url.includes('nullValue'));
        assert.ok(!result.body.url.includes('undefinedValue'));
        assert.ok(result.body.url.includes('valid=value'));
      } finally {
        await server.close();
      }
    });
  });

  describe('POST requests', () => {
    it('should execute POST with JSON body', async () => {
      const server = new MockServer(echoBodyHandler());
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/users'),
          method: 'POST',
          body: { name: 'John', email: 'john@example.com' },
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.deepStrictEqual(result.body.received, {
          name: 'John',
          email: 'john@example.com',
        });
      } finally {
        await server.close();
      }
    });

    it('should auto-set content-type to application/json', async () => {
      const server = new MockServer(
        headerValidatingHandler({ 'content-type': 'application/json' })
      );
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/users'),
          method: 'POST',
          body: { test: true },
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
      } finally {
        await server.close();
      }
    });

    it('should not override custom content-type', async () => {
      const server = new MockServer(
        headerValidatingHandler({ 'content-type': 'application/xml' })
      );
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/users'),
          method: 'POST',
          headers: { 'content-type': 'application/xml' },
          body: { test: true },
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
      } finally {
        await server.close();
      }
    });
  });

  describe('Headers', () => {
    it('should send custom headers', async () => {
      const server = new MockServer(
        headerValidatingHandler({
          'authorization': 'Bearer token123',
          'x-custom-header': 'custom-value',
        })
      );
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/protected'),
          method: 'GET',
          headers: {
            'Authorization': 'Bearer token123',
            'X-Custom-Header': 'custom-value',
          },
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
      } finally {
        await server.close();
      }
    });

    it('should extract response headers', async () => {
      const server = new MockServer((req, res) => {
        res.writeHead(200, {
          'content-type': 'application/json',
          'x-response-header': 'response-value',
        });
        res.end(JSON.stringify({ success: true }));
      });
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/test'),
          method: 'GET',
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.ok(result.headers);
        assert.strictEqual(result.headers['x-response-header'], 'response-value');
      } finally {
        await server.close();
      }
    });
  });

  describe('Cookies', () => {
    it('should send cookies', async () => {
      const server = new MockServer(
        cookieValidatingHandler({ session: 'abc123', user: 'john' })
      );
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/session'),
          method: 'GET',
          cookies: { session: 'abc123', user: 'john' },
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
      } finally {
        await server.close();
      }
    });

    it('should extract response cookies', async () => {
      const server = new MockServer(
        cookieHandler({ token: 'xyz789', refresh: 'refresh123' })
      );
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/login'),
          method: 'POST',
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.ok(result.cookies);
        assert.strictEqual(result.cookies.token, 'xyz789');
        assert.strictEqual(result.cookies.refresh, 'refresh123');
      } finally {
        await server.close();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle server errors', async () => {
      const server = new MockServer(errorHandler(500, 'Internal Server Error'));
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/fail'),
          method: 'GET',
        }, {}, 'testService');

        assert.strictEqual(result.status, 500);
      } finally {
        await server.close();
      }
    });

    it('should handle connection errors', async () => {
      const result = await executeRestService({
        type: 'rest',
        url: 'http://localhost:99999/nonexistent',
        method: 'GET',
      }, {}, 'testService');

      assert.strictEqual(result.status, null);
      assert.ok(result.error);
      assert.strictEqual(result.metadata?.executionStatus, 'failed');
    });

    it('should use fallback on error', async () => {
      const result = await executeRestService({
        type: 'rest',
        url: 'http://localhost:99999/nonexistent',
        method: 'GET',
        fallback: {
          status: 200,
          data: { fallback: true },
        },
      }, {}, 'testService');

      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.body, { fallback: true });
      assert.strictEqual(result.metadata?.fallbackUsed, true);
    });
  });

  describe('Binary media handling', () => {
    it('should handle image/png responses as Buffer', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const server = new MockServer((req, res) => {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(pngBuffer);
      });
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/image.png'),
          method: 'GET',
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.ok(Buffer.isBuffer(result.body));
        assert.deepStrictEqual(result.body, pngBuffer);
      } finally {
        await server.close();
      }
    });

    it('should handle application/pdf responses as Buffer', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4');
      const server = new MockServer((req, res) => {
        res.writeHead(200, { 'content-type': 'application/pdf' });
        res.end(pdfBuffer);
      });
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/document.pdf'),
          method: 'GET',
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.ok(Buffer.isBuffer(result.body));
      } finally {
        await server.close();
      }
    });
  });

  describe('Text responses', () => {
    it('should handle text/plain responses', async () => {
      const server = new MockServer((req, res) => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('Hello, plain text!');
      });
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/text'),
          method: 'GET',
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, 'Hello, plain text!');
      } finally {
        await server.close();
      }
    });

    it('should handle empty JSON response body', async () => {
      const server = new MockServer((req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('');
      });
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/empty'),
          method: 'GET',
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, null);
      } finally {
        await server.close();
      }
    });
  });

  describe('PUT and PATCH requests', () => {
    it('should handle PUT request with body', async () => {
      const server = new MockServer(echoBodyHandler());
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/users/1'),
          method: 'PUT',
          body: { name: 'Updated Name' },
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.deepStrictEqual(result.body.received, { name: 'Updated Name' });
      } finally {
        await server.close();
      }
    });

    it('should handle PATCH request with body', async () => {
      const server = new MockServer(echoBodyHandler());
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/users/1'),
          method: 'PATCH',
          body: { email: 'new@example.com' },
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.deepStrictEqual(result.body.received, { email: 'new@example.com' });
      } finally {
        await server.close();
      }
    });
  });

  describe('Query parameter edge cases', () => {
    it('should handle empty query object', async () => {
      const server = new MockServer((req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ url: req.url }));
      });
      await server.listen();

      try {
        const result = await executeRestService({
          type: 'rest',
          url: server.getUrl('/api/test'),
          method: 'GET',
          query: {},
        }, {}, 'testService');

        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body.url, '/api/test');
      } finally {
        await server.close();
      }
    });
  });
});
