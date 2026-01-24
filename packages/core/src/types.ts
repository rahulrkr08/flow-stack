/**
 * Base service configuration that all service types extend
 */
export interface BaseServiceConfig {
  type: string;
  fallback?: {
    status?: number | null;
    data: any;
  };
  errorStrategy?: 'silent' | 'throw';
}

/**
 * Custom service configuration with handler function (default type)
 */
export interface CustomServiceConfig extends BaseServiceConfig {
  type: 'custom';
  handler: CustomHandler;
}

/**
 * Custom handler function type
 * Receives context and returns ServiceResult
 */
export type CustomHandler = (
  context: OrchestrationContext
) => Promise<ServiceResult> | ServiceResult;

/**
 * Service configuration - base type that plugins can extend
 * Default is 'custom' type
 */
export type ServiceConfig = CustomServiceConfig | BaseServiceConfig;

/**
 * Service block with dependencies
 */
export interface ServiceBlock {
  id: string;
  dependsOn?: string[];
  service: ServiceConfig;
  condition?: (context: any) => boolean;
  errorStrategy?: 'silent' | 'throw';
}

/**
 * Orchestration configuration
 */
export interface OrchestrationConfig {
  services: ServiceBlock[];
}

/**
 * Runtime context passed through execution
 */
export interface OrchestrationContext {
  request?: {
    body?: any;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    query?: Record<string, string>;
  };
  env?: Record<string, string>;
  [key: string]: any;
}

/**
 * Service result metadata
 */
export interface ServiceResultMetadata {
  executionStatus?: 'executed' | 'skipped' | 'failed' | 'pending';
  fallbackUsed?: boolean;
  serviceType?: string;
}

/**
 * Service execution result
 */
export interface ServiceResult {
  status: number | null;
  body: any;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  error?: any;
  metadata?: ServiceResultMetadata;
}

/**
 * Final orchestration result
 */
export interface OrchestrationResult {
  context: Record<string, ServiceResult>;
  services: Record<string, ServiceResult>;
}

/**
 * Plugin executor function type
 * Each plugin provides an executor that handles its service type
 */
export type PluginExecutor<TConfig extends BaseServiceConfig = BaseServiceConfig> = (
  config: TConfig,
  context: OrchestrationContext,
  serviceId: string
) => Promise<ServiceResult>;

/**
 * Plugin definition interface
 * Plugins register with flow-stack to handle specific service types
 */
export interface FlowStackPlugin<TConfig extends BaseServiceConfig = BaseServiceConfig> {
  /** Unique type identifier for this plugin (e.g., 'rest', 'graphql') */
  type: string;
  /** Human-readable name for the plugin */
  name: string;
  /** Version of the plugin */
  version: string;
  /** The executor function that processes services of this type */
  execute: PluginExecutor<TConfig>;
  /** Whether to interpolate config before passing to executor (default: true) */
  interpolate?: boolean;
}
