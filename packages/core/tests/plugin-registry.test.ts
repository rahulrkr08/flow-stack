import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  registerPlugin,
  unregisterPlugin,
  getPlugin,
  hasPlugin,
  getPluginTypes,
  getPlugins,
  clearPlugins,
} from '../src/plugin-registry.js';
import type { FlowStackPlugin, BaseServiceConfig } from '../src/types.js';

// Test plugin configuration
interface TestServiceConfig extends BaseServiceConfig {
  type: 'test';
  value: string;
}

const testPlugin: FlowStackPlugin<TestServiceConfig> = {
  type: 'test',
  name: 'test-plugin',
  version: '1.0.0',
  execute: async (config, context, serviceId) => ({
    status: 200,
    body: { value: config.value },
    metadata: { executionStatus: 'executed', serviceType: 'test' },
  }),
};

const anotherPlugin: FlowStackPlugin<BaseServiceConfig> = {
  type: 'another',
  name: 'another-plugin',
  version: '2.0.0',
  execute: async () => ({
    status: 200,
    body: {},
    metadata: { executionStatus: 'executed', serviceType: 'another' },
  }),
};

describe('Plugin Registry', () => {
  beforeEach(() => {
    clearPlugins();
  });

  afterEach(() => {
    clearPlugins();
  });

  describe('registerPlugin', () => {
    it('should register a plugin', () => {
      registerPlugin(testPlugin);
      assert.ok(hasPlugin('test'));
    });

    it('should throw error when registering duplicate plugin type', () => {
      registerPlugin(testPlugin);

      const duplicatePlugin: FlowStackPlugin<TestServiceConfig> = {
        ...testPlugin,
        name: 'duplicate-plugin',
      };

      assert.throws(
        () => registerPlugin(duplicatePlugin),
        (err: Error) => {
          assert.ok(err.message.includes("Plugin for type 'test' is already registered"));
          assert.ok(err.message.includes('test-plugin'));
          return true;
        }
      );
    });

    it('should allow registering multiple different plugins', () => {
      registerPlugin(testPlugin);
      registerPlugin(anotherPlugin);

      assert.ok(hasPlugin('test'));
      assert.ok(hasPlugin('another'));
    });
  });

  describe('unregisterPlugin', () => {
    it('should unregister a plugin', () => {
      registerPlugin(testPlugin);
      assert.ok(hasPlugin('test'));

      const result = unregisterPlugin('test');
      assert.strictEqual(result, true);
      assert.strictEqual(hasPlugin('test'), false);
    });

    it('should return false when unregistering non-existent plugin', () => {
      const result = unregisterPlugin('nonexistent');
      assert.strictEqual(result, false);
    });
  });

  describe('getPlugin', () => {
    it('should return registered plugin', () => {
      registerPlugin(testPlugin);

      const plugin = getPlugin('test');
      assert.ok(plugin);
      assert.strictEqual(plugin.type, 'test');
      assert.strictEqual(plugin.name, 'test-plugin');
      assert.strictEqual(plugin.version, '1.0.0');
    });

    it('should return undefined for non-existent plugin', () => {
      const plugin = getPlugin('nonexistent');
      assert.strictEqual(plugin, undefined);
    });
  });

  describe('hasPlugin', () => {
    it('should return true for registered plugin', () => {
      registerPlugin(testPlugin);
      assert.strictEqual(hasPlugin('test'), true);
    });

    it('should return false for non-existent plugin', () => {
      assert.strictEqual(hasPlugin('nonexistent'), false);
    });
  });

  describe('getPluginTypes', () => {
    it('should return empty array when no plugins registered', () => {
      const types = getPluginTypes();
      assert.deepStrictEqual(types, []);
    });

    it('should return all registered plugin types', () => {
      registerPlugin(testPlugin);
      registerPlugin(anotherPlugin);

      const types = getPluginTypes();
      assert.strictEqual(types.length, 2);
      assert.ok(types.includes('test'));
      assert.ok(types.includes('another'));
    });
  });

  describe('getPlugins', () => {
    it('should return empty array when no plugins registered', () => {
      const plugins = getPlugins();
      assert.deepStrictEqual(plugins, []);
    });

    it('should return all registered plugins', () => {
      registerPlugin(testPlugin);
      registerPlugin(anotherPlugin);

      const plugins = getPlugins();
      assert.strictEqual(plugins.length, 2);

      const names = plugins.map(p => p.name);
      assert.ok(names.includes('test-plugin'));
      assert.ok(names.includes('another-plugin'));
    });
  });

  describe('clearPlugins', () => {
    it('should remove all registered plugins', () => {
      registerPlugin(testPlugin);
      registerPlugin(anotherPlugin);
      assert.strictEqual(getPlugins().length, 2);

      clearPlugins();
      assert.strictEqual(getPlugins().length, 0);
      assert.strictEqual(hasPlugin('test'), false);
      assert.strictEqual(hasPlugin('another'), false);
    });
  });

  describe('Plugin execution', () => {
    it('should execute plugin with correct parameters', async () => {
      let receivedConfig: any;
      let receivedContext: any;
      let receivedServiceId: any;

      const capturePlugin: FlowStackPlugin<BaseServiceConfig> = {
        type: 'capture',
        name: 'capture-plugin',
        version: '1.0.0',
        execute: async (config, context, serviceId) => {
          receivedConfig = config;
          receivedContext = context;
          receivedServiceId = serviceId;
          return { status: 200, body: {}, metadata: { executionStatus: 'executed' } };
        },
      };

      registerPlugin(capturePlugin);

      const plugin = getPlugin('capture');
      assert.ok(plugin);

      const testConfig = { type: 'capture', testValue: 123 };
      const testContext = { env: { KEY: 'value' } };

      await plugin.execute(testConfig as any, testContext, 'myServiceId');

      assert.deepStrictEqual(receivedConfig, testConfig);
      assert.deepStrictEqual(receivedContext, testContext);
      assert.strictEqual(receivedServiceId, 'myServiceId');
    });
  });

  describe('Plugin interpolate flag', () => {
    it('should default interpolate to undefined (treated as true)', () => {
      const minimalPlugin: FlowStackPlugin = {
        type: 'minimal',
        name: 'minimal-plugin',
        version: '1.0.0',
        execute: async () => ({ status: 200, body: {} }),
      };

      registerPlugin(minimalPlugin);
      const plugin = getPlugin('minimal');
      assert.strictEqual(plugin?.interpolate, undefined);
    });

    it('should preserve explicit interpolate: false', () => {
      const noInterpolatePlugin: FlowStackPlugin = {
        type: 'no-interp',
        name: 'no-interpolate-plugin',
        version: '1.0.0',
        execute: async () => ({ status: 200, body: {} }),
        interpolate: false,
      };

      registerPlugin(noInterpolatePlugin);
      const plugin = getPlugin('no-interp');
      assert.strictEqual(plugin?.interpolate, false);
    });

    it('should preserve explicit interpolate: true', () => {
      const interpolatePlugin: FlowStackPlugin = {
        type: 'interp',
        name: 'interpolate-plugin',
        version: '1.0.0',
        execute: async () => ({ status: 200, body: {} }),
        interpolate: true,
      };

      registerPlugin(interpolatePlugin);
      const plugin = getPlugin('interp');
      assert.strictEqual(plugin?.interpolate, true);
    });
  });
});
