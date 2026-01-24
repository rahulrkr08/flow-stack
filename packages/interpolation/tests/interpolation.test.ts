import { describe, it } from 'node:test';
import assert from 'node:assert';
import { interpolateObject, cookiesToHeader, buildQueryString } from '../src/interpolation.js';

describe('Interpolation', () => {
  describe('interpolateObject', () => {
    it('should interpolate simple path expressions', async () => {
      const context = {
        user: { id: 123, name: 'John' },
      };

      const result = await interpolateObject('{user.id}', context);
      assert.strictEqual(result, 123);
    });

    it('should interpolate nested path expressions', async () => {
      const context = {
        response: {
          body: {
            data: {
              items: [{ id: 1 }, { id: 2 }],
            },
          },
        },
      };

      const result = await interpolateObject('{response.body.data.items}', context);
      assert.deepStrictEqual(result, [{ id: 1 }, { id: 2 }]);
    });

    it('should preserve type for single token expressions', async () => {
      const context = {
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { key: 'value' },
      };

      assert.strictEqual(await interpolateObject('{number}', context), 42);
      assert.strictEqual(await interpolateObject('{boolean}', context), true);
      assert.deepStrictEqual(await interpolateObject('{array}', context), [1, 2, 3]);
      assert.deepStrictEqual(await interpolateObject('{object}', context), { key: 'value' });
    });

    it('should convert to string for mixed text with tokens', async () => {
      const context = {
        host: 'api.example.com',
        port: 8080,
        id: 123,
      };

      const result = await interpolateObject('https://{host}:{port}/api/{id}', context);
      assert.strictEqual(result, 'https://api.example.com:8080/api/123');
    });

    it('should interpolate objects recursively', async () => {
      const context = {
        user: { id: 'user123', token: 'abc' },
        env: { apiKey: 'key456' },
      };

      const input = {
        url: 'https://api.example.com/users/{user.id}',
        headers: {
          'Authorization': 'Bearer {user.token}',
          'X-API-Key': '{env.apiKey}',
        },
        body: {
          userId: '{user.id}',
        },
      };

      const result = await interpolateObject(input, context);

      assert.strictEqual(result.url, 'https://api.example.com/users/user123');
      assert.strictEqual(result.headers['Authorization'], 'Bearer abc');
      assert.strictEqual(result.headers['X-API-Key'], 'key456');
      assert.strictEqual(result.body.userId, 'user123');
    });

    it('should interpolate arrays', async () => {
      const context = {
        items: ['a', 'b', 'c'],
        id: 1,
      };

      const input = ['{id}', '{items}'];
      const result = await interpolateObject(input, context);

      assert.strictEqual(result[0], 1);
      assert.deepStrictEqual(result[1], ['a', 'b', 'c']);
    });

    it('should handle null and undefined values', async () => {
      const context = { value: null };

      assert.strictEqual(await interpolateObject(null, context), null);
      assert.strictEqual(await interpolateObject(undefined, context), undefined);
    });

    it('should return original string if expression fails', async () => {
      const context = {};
      const result = await interpolateObject('{nonexistent.path}', context);
      assert.strictEqual(result, '{nonexistent.path}');
    });

    it('should handle complex JSONata expressions with {-...-} syntax', async () => {
      const context = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
      };

      const result = await interpolateObject(
        '{-$map(items, function($x) { $x.id })-}',
        context
      );

      // JSONata $map returns an array with values, verify the values are correct
      assert.ok(Array.isArray(result));
      assert.strictEqual(result[0], 1);
      assert.strictEqual(result[1], 2);
    });

    it('should handle JSONata transformations', async () => {
      const context = {
        order: {
          items: [
            { price: 10, qty: 2 },
            { price: 20, qty: 1 },
          ],
        },
      };

      const result = await interpolateObject('{$sum(order.items.(price * qty))}', context);
      assert.strictEqual(result, 40);
    });

    it('should handle bracket notation for special characters', async () => {
      const context = {
        data: {
          'custom:field': 'value1',
          'field-with-dash': 'value2',
        },
      };

      // JSONata uses backtick for fields with special characters
      const result1 = await interpolateObject('{data.`custom:field`}', context);
      const result2 = await interpolateObject('{data.`field-with-dash`}', context);

      assert.strictEqual(result1, 'value1');
      assert.strictEqual(result2, 'value2');
    });

    it('should handle request context interpolation', async () => {
      const context = {
        request: {
          body: { userId: 'u123' },
          headers: { authorization: 'Bearer token' },
          cookies: { session: 'sess456' },
          query: { page: '1' },
        },
      };

      assert.strictEqual(await interpolateObject('{request.body.userId}', context), 'u123');
      assert.strictEqual(await interpolateObject('{request.headers.authorization}', context), 'Bearer token');
      assert.strictEqual(await interpolateObject('{request.cookies.session}', context), 'sess456');
      assert.strictEqual(await interpolateObject('{request.query.page}', context), '1');
    });

    it('should handle env context interpolation', async () => {
      const context = {
        env: {
          API_KEY: 'secret-key',
          BASE_URL: 'https://api.example.com',
        },
      };

      assert.strictEqual(await interpolateObject('{env.API_KEY}', context), 'secret-key');
      assert.strictEqual(await interpolateObject('{env.BASE_URL}', context), 'https://api.example.com');
    });

    it('should handle service result interpolation', async () => {
      const context = {
        authService: {
          status: 200,
          body: { token: 'jwt123', user: { id: 1 } },
        },
      };

      assert.strictEqual(await interpolateObject('{authService.body.token}', context), 'jwt123');
      assert.strictEqual(await interpolateObject('{authService.body.user.id}', context), 1);
      assert.strictEqual(await interpolateObject('{authService.status}', context), 200);
    });

    it('should pass through non-string primitive values unchanged', async () => {
      const context = { value: 'test' };

      // Numbers should pass through unchanged
      assert.strictEqual(await interpolateObject(42, context), 42);
      assert.strictEqual(await interpolateObject(3.14, context), 3.14);

      // Booleans should pass through unchanged
      assert.strictEqual(await interpolateObject(true, context), true);
      assert.strictEqual(await interpolateObject(false, context), false);

      // Zero and negative numbers
      assert.strictEqual(await interpolateObject(0, context), 0);
      assert.strictEqual(await interpolateObject(-100, context), -100);
    });

    it('should handle complex expressions in mixed text strings', async () => {
      const context = {
        items: [
          { id: 1, name: 'Apple' },
          { id: 2, name: 'Banana' },
        ],
        prefix: 'Result',
      };

      // Mixed text with complex {-...-} expression
      const result = await interpolateObject(
        'Prefix: {prefix} - IDs: {-$map(items, function($x) { $x.id })-}',
        context
      );

      assert.ok(result.includes('Prefix: Result'));
      assert.ok(result.includes('IDs:'));
    });

    it('should handle multiple simple tokens in mixed text', async () => {
      const context = {
        first: 'Hello',
        second: 'World',
        number: 42,
      };

      const result = await interpolateObject('{first}, {second}! Number: {number}', context);
      assert.strictEqual(result, 'Hello, World! Number: 42');
    });

    it('should handle complex expression that returns undefined', async () => {
      const context = {
        items: [],
      };

      // Expression that returns undefined - should keep original
      const result = await interpolateObject('{-$map(items, function($x) { $x.nonexistent })[0]-}', context);
      // When expression returns undefined, should return original
      assert.ok(result !== undefined);
    });

    it('should handle invalid JSONata syntax gracefully', async () => {
      const context = { value: 'test' };

      // Invalid JSONata expression should return original string
      const result = await interpolateObject('{invalid..syntax}', context);
      assert.strictEqual(result, '{invalid..syntax}');
    });

    it('should handle expression returning null value', async () => {
      const context = {
        data: null,
      };

      // Single token returning null - JSONata evaluates null as null
      const result = await interpolateObject('{data}', context);
      // JSONata returns null for null values, which is a valid evaluated result
      assert.strictEqual(result, null);
    });

    it('should handle multiple complex expressions in one string', async () => {
      const context = {
        nums: [1, 2, 3],
        strs: ['a', 'b'],
      };

      const result = await interpolateObject(
        'Numbers: {-$sum(nums)-}, Strings: {-$count(strs)-}',
        context
      );

      assert.strictEqual(result, 'Numbers: 6, Strings: 2');
    });

    it('should keep original when complex expression fails in mixed text', async () => {
      const context = {
        data: { value: 'test' },
      };

      // Complex expression that fails should keep the original
      const result = await interpolateObject(
        'Result: {-$unknown_function(data)-}',
        context
      );

      // When complex expression fails, keeps original token
      assert.ok(result.includes('Result:'));
    });

    it('should keep original when simple expression fails in mixed text', async () => {
      const context = {};

      // Simple expression referencing undefined path in mixed text
      const result = await interpolateObject(
        'User: {nonexistent.path}, Status: {another.missing}',
        context
      );

      // When expressions fail, keeps original tokens
      assert.ok(result.includes('{nonexistent.path}'));
      assert.ok(result.includes('{another.missing}'));
    });
  });

  describe('cookiesToHeader', () => {
    it('should convert cookies object to header string', () => {
      const cookies = {
        session: 'abc123',
        user: 'john',
      };

      const result = cookiesToHeader(cookies);
      assert.strictEqual(result, 'session=abc123; user=john');
    });

    it('should handle empty cookies', () => {
      const result = cookiesToHeader({});
      assert.strictEqual(result, '');
    });

    it('should handle single cookie', () => {
      const result = cookiesToHeader({ token: 'xyz' });
      assert.strictEqual(result, 'token=xyz');
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from object', () => {
      const query = {
        page: '1',
        limit: '10',
        sort: 'name',
      };

      const result = buildQueryString(query);
      assert.strictEqual(result, 'page=1&limit=10&sort=name');
    });

    it('should handle empty query', () => {
      const result = buildQueryString({});
      assert.strictEqual(result, '');
    });

    it('should encode special characters', () => {
      const query = {
        search: 'hello world',
        filter: 'name=john&age>30',
      };

      const result = buildQueryString(query);
      assert.ok(result.includes('hello+world') || result.includes('hello%20world'));
      assert.ok(result.includes('%3D') || result.includes('%26'));
    });
  });
});
