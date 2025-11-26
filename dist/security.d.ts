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
//# sourceMappingURL=security.d.ts.map