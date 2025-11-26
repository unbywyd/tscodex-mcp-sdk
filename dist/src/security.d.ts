/**
 * Security utilities for MCP SDK
 */
/**
 * Safely resolve and validate a file path within a root directory
 *
 * @param rootPath - The root directory path
 * @param userPath - The user-provided path (potentially unsafe)
 * @returns The safe, resolved path
 * @throws Error if the path is outside the root or invalid
 */
export declare function safePath(rootPath: string, userPath: string): string;
/**
 * Validate that a path doesn't contain dangerous patterns
 *
 * @param userPath - The path to validate
 * @returns true if path is safe
 */
export declare function isPathSafe(userPath: string): boolean;
/**
 * Sanitize a filename to remove dangerous characters
 *
 * @param filename - The filename to sanitize
 * @returns Sanitized filename
 */
export declare function sanitizeFilename(filename: string): string;
/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
    /** Maximum requests per window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Message to send when rate limit is exceeded */
    message?: string;
}
/**
 * Simple in-memory rate limiter
 */
export declare class RateLimiter {
    private config;
    private requests;
    constructor(config: RateLimitConfig);
    /**
     * Check if a request should be allowed
     *
     * @param identifier - Unique identifier for the client (IP, session ID, etc.)
     * @returns true if request is allowed, false if rate limited
     */
    isAllowed(identifier: string): boolean;
    /**
     * Clean up expired records
     */
    cleanup(): void;
    /**
     * Get rate limit headers for response
     */
    getHeaders(identifier: string): Record<string, string>;
}
/**
 * Validate request size
 *
 * @param contentLength - Content-Length header value
 * @param maxSize - Maximum allowed size in bytes
 * @throws Error if content is too large
 */
export declare function validateRequestSize(contentLength: string | undefined, maxSize?: number): void;
/**
 * Filter sensitive fields from configuration object
 *
 * Replaces values of fields containing sensitive keywords with '***'
 * to prevent accidental exposure of secrets in tool responses or logs.
 *
 * Sensitive keywords: 'key', 'token', 'secret', 'password', 'apikey'
 *
 * @param config - Configuration object to filter
 * @returns Configuration object with sensitive fields masked
 *
 * @example
 * ```typescript
 * const config = { apiKey: 'secret123', timeout: 5000 };
 * const safe = filterSecrets(config);
 * // { apiKey: '***', timeout: 5000 }
 * ```
 */
export declare function filterSecrets<T extends Record<string, unknown>>(config: T): Record<string, unknown>;
/**
 * Filter configuration to only include keys that start with 'mcp' prefix (case-insensitive)
 *
 * This is a security measure to prevent exposure of non-MCP configuration keys
 * in MCP tool/resource/prompt contexts.
 *
 * Only keys starting with 'mcp' (e.g., 'mcpTimeout', 'mcpApiKey', 'MCP_RETRIES') are kept.
 *
 * @param config - Configuration object to filter
 * @returns Configuration object with only MCP-prefixed keys
 *
 * @example
 * ```typescript
 * const config = { timeout: 5000, mcpTimeout: 10000, apiKey: 'secret' };
 * const mcpConfig = filterMcpConfig(config);
 * // { mcpTimeout: 10000 }
 * ```
 */
export declare function filterMcpConfig<T extends Record<string, unknown>>(config: T): Record<string, unknown>;
/**
 * Filter configuration to only include keys that start with 'mcp_' prefix (case-insensitive)
 *
 * This function filters config to expose only public MCP configuration parameters
 * that can be safely passed to handlers. Only keys starting with 'mcp_' are kept.
 *
 * This is used by default context creation to provide handlers with public MCP config
 * while keeping full config available via server instance if needed.
 *
 * @param config - Configuration object to filter
 * @returns Configuration object with only 'mcp_' prefixed keys
 *
 * @example
 * ```typescript
 * const config = { timeout: 5000, mcp_timeout: 10000, mcp_api_url: 'https://api.example.com', apiKey: 'secret' };
 * const publicConfig = filterMcpPublicConfig(config);
 * // { mcp_timeout: 10000, mcp_api_url: 'https://api.example.com' }
 * ```
 */
export declare function filterMcpPublicConfig<T extends Record<string, unknown>>(config: T): Record<string, unknown>;
//# sourceMappingURL=security.d.ts.map