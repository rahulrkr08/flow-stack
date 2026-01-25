# @workflow-stack/interpolation

JSONata-based interpolation utilities for @workflow-stack. Recursively interpolates string values in objects using powerful JSONata expressions.

## Installation

```bash
npm install @workflow-stack/interpolation
```

## Usage

```typescript
import { interpolateObject, cookiesToHeader, buildQueryString } from '@workflow-stack/interpolation';
```

### interpolateObject

Recursively interpolates all string values in an object using JSONata expressions wrapped in curly braces.

```typescript
const context = {
  user: { id: 123, name: 'John' },
  env: { apiKey: 'secret-key' }
};

// Simple path expressions
await interpolateObject('{user.id}', context);
// => 123 (preserves number type)

// Nested object interpolation
await interpolateObject({
  url: 'https://api.example.com/users/{user.id}',
  headers: {
    'Authorization': 'Bearer {env.apiKey}'
  }
}, context);
// => { url: 'https://api.example.com/users/123', headers: { Authorization: 'Bearer secret-key' } }
```

### Type Preservation

Single token expressions preserve the original type:

```typescript
const context = {
  number: 42,
  boolean: true,
  array: [1, 2, 3],
  object: { key: 'value' }
};

await interpolateObject('{number}', context);   // => 42 (number)
await interpolateObject('{boolean}', context);  // => true (boolean)
await interpolateObject('{array}', context);    // => [1, 2, 3] (array)
await interpolateObject('{object}', context);   // => { key: 'value' } (object)
```

Mixed text with tokens returns a string:

```typescript
await interpolateObject('https://{host}:{port}/api', { host: 'example.com', port: 8080 });
// => 'https://example.com:8080/api'
```

### JSONata Features

Full JSONata expression support:

```typescript
const context = {
  order: {
    items: [
      { price: 10, qty: 2 },
      { price: 20, qty: 1 }
    ]
  },
  users: [
    { name: 'alice', status: 'active' },
    { name: 'bob', status: 'inactive' }
  ]
};

// Aggregations
await interpolateObject('{$sum(order.items.(price * qty))}', context);
// => 40

// Filters
await interpolateObject('{users[status="active"].name}', context);
// => 'alice'

// Transformations
await interpolateObject('{users.name.$uppercase()}', context);
// => ['ALICE', 'BOB']
```

### Complex Expressions with Nested Braces

Use `{-expression-}` syntax for expressions containing nested braces:

```typescript
const context = {
  items: [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
  ]
};

await interpolateObject('{-$map(items, function($x) { $x.id })-}', context);
// => [1, 2]
```

### cookiesToHeader

Converts a cookies object to a Cookie header string:

```typescript
cookiesToHeader({ session: 'abc123', user: 'john' });
// => 'session=abc123; user=john'
```

### buildQueryString

Converts an object to a URL query string:

```typescript
buildQueryString({ page: '1', limit: '10', sort: 'name' });
// => 'page=1&limit=10&sort=name'
```

## API

### `interpolateObject(obj: any, context: InterpolationContext): Promise<any>`

Recursively interpolates all string values in an object using JSONata expressions.

- **obj**: The value to interpolate (string, object, array, or primitive)
- **context**: The context object available for expression evaluation
- **returns**: The interpolated value with preserved types

### `cookiesToHeader(cookies: Record<string, string>): string`

Converts a cookies object to a Cookie header string.

### `buildQueryString(query: Record<string, string>): string`

Converts a query object to a URL-encoded query string.

### `InterpolationContext`

Type definition for the context object:

```typescript
type InterpolationContext = Record<string, any>;
```

## Error Handling

If a JSONata expression fails to evaluate, the original string is preserved:

```typescript
await interpolateObject('{nonexistent.path}', {});
// => '{nonexistent.path}'
```

## License

MIT
