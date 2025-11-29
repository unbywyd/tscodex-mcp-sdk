/**
 * @tscodex/mcp-sdk
 *
 * Main entry point for MCP Server SDK
 *
 * This SDK provides a clean abstraction for creating MCP servers
 * with automatic Extension support and configuration management.
 */
export { Type, Static } from '@sinclair/typebox';
export { McpServer } from './server.js';
export type { McpServerOptions, Schema, ToolConfig, ResourceConfig, PromptConfig, ToolHandler, ResourceHandler, PromptHandler, ToolContext, ResourceContext, PromptContext, ToolResult, ResourceResult, PromptResult, Logger, AuthConfig, RoleGuard, ErrorHandler, ErrorHandlerContext, ServerHttpOptions, ServerSecurityOptions, ServerHandlerOptions } from './types.js';
export type { McpServerInfo, ExtensionEndpoint, HealthResponse, ConfigResponse, ServerMetadata } from './extension.js';
export { createHttpTransport, TransportManager, type CorsOptions } from './transport.js';
export { validateConfig, updateConfig } from './config.js';
export { loadConfig, type ConfigLoaderOptions } from './config-loader.js';
export { safePath, isPathSafe, sanitizeFilename, RateLimiter, validateRequestSize, filterSecrets, filterMcpConfig, filterMcpPublicConfig, type RateLimitConfig } from './security.js';
export declare const SDK_VERSION = "0.0.1";
//# sourceMappingURL=index.d.ts.map