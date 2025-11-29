/**
 * @tscodex/mcp-sdk
 *
 * Main entry point for MCP Server SDK
 *
 * This SDK provides a clean abstraction for creating MCP servers
 * with automatic Extension support and configuration management.
 */
// Re-export TypeBox for convenience (Type, Static, etc.)
export { Type } from '@sinclair/typebox';
// Core exports
export { McpServer } from './server.js';
// Utilities
export { createHttpTransport, TransportManager } from './transport.js';
export { validateConfig, updateConfig } from './config.js';
export { loadConfig } from './config-loader.js';
export { safePath, isPathSafe, sanitizeFilename, RateLimiter, validateRequestSize, filterSecrets, filterMcpConfig, filterMcpPublicConfig } from './security.js';
// Export version
export const SDK_VERSION = '0.1.0';
//# sourceMappingURL=index.js.map