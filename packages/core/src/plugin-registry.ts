import type { FlowStackPlugin, BaseServiceConfig } from './types.js';

/**
 * Plugin registry for managing service type plugins
 * Plugins can be registered to handle specific service types
 */
class PluginRegistry {
  private plugins: Map<string, FlowStackPlugin<any>> = new Map();

  /**
   * Register a plugin to handle a specific service type
   * @param plugin The plugin to register
   * @throws Error if a plugin with the same type is already registered
   */
  register<TConfig extends BaseServiceConfig>(plugin: FlowStackPlugin<TConfig>): void {
    if (this.plugins.has(plugin.type)) {
      throw new Error(
        `Plugin for type '${plugin.type}' is already registered. ` +
        `Registered: ${this.plugins.get(plugin.type)!.name} v${this.plugins.get(plugin.type)!.version}`
      );
    }
    this.plugins.set(plugin.type, plugin);
  }

  /**
   * Unregister a plugin by its type
   * @param type The service type to unregister
   * @returns true if the plugin was removed, false if it wasn't registered
   */
  unregister(type: string): boolean {
    return this.plugins.delete(type);
  }

  /**
   * Get a registered plugin by type
   * @param type The service type to look up
   * @returns The plugin or undefined if not found
   */
  get<TConfig extends BaseServiceConfig>(type: string): FlowStackPlugin<TConfig> | undefined {
    return this.plugins.get(type) as FlowStackPlugin<TConfig> | undefined;
  }

  /**
   * Check if a plugin is registered for a type
   * @param type The service type to check
   */
  has(type: string): boolean {
    return this.plugins.has(type);
  }

  /**
   * Get all registered plugin types
   */
  getTypes(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get all registered plugins
   */
  getAll(): FlowStackPlugin<any>[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Clear all registered plugins
   */
  clear(): void {
    this.plugins.clear();
  }
}

// Global plugin registry instance
export const pluginRegistry = new PluginRegistry();

/**
 * Register a plugin with flow-stack
 * @param plugin The plugin to register
 */
export function registerPlugin<TConfig extends BaseServiceConfig>(
  plugin: FlowStackPlugin<TConfig>
): void {
  pluginRegistry.register(plugin);
}

/**
 * Unregister a plugin by type
 * @param type The service type to unregister
 */
export function unregisterPlugin(type: string): boolean {
  return pluginRegistry.unregister(type);
}

/**
 * Get a plugin by type
 * @param type The service type to look up
 */
export function getPlugin<TConfig extends BaseServiceConfig>(
  type: string
): FlowStackPlugin<TConfig> | undefined {
  return pluginRegistry.get<TConfig>(type);
}

/**
 * Check if a plugin is registered
 * @param type The service type to check
 */
export function hasPlugin(type: string): boolean {
  return pluginRegistry.has(type);
}

/**
 * Get all registered plugin types
 */
export function getPluginTypes(): string[] {
  return pluginRegistry.getTypes();
}

/**
 * Get all registered plugins
 */
export function getPlugins(): FlowStackPlugin<any>[] {
  return pluginRegistry.getAll();
}

/**
 * Clear all registered plugins (useful for testing)
 */
export function clearPlugins(): void {
  pluginRegistry.clear();
}
