/**
 * Security utilities for MCP SDK
 */
import * as path from 'path';
import * as fs from 'fs';
/**
 * Safely resolve and validate a file path within a root directory
 *
 * @param rootPath - The root directory path
 * @param userPath - The user-provided path (potentially unsafe)
 * @returns The safe, resolved path
 * @throws Error if the path is outside the root or invalid
 */
export function safePath(rootPath, userPath) {
    // Normalize both paths
    const normalizedRoot = path.resolve(rootPath);
    const resolvedPath = path.resolve(rootPath, userPath);
    // Check if the resolved path starts with the root path
    // Use platform-specific comparison
    if (process.platform === 'win32') {
        // Windows: case-insensitive comparison
        const rootLower = normalizedRoot.toLowerCase();
        const pathLower = resolvedPath.toLowerCase();
        if (!pathLower.startsWith(rootLower)) {
            throw new Error(`Path traversal attempt detected: ${userPath}`);
        }
    }
    else {
        // Unix-like: case-sensitive comparison
        if (!resolvedPath.startsWith(normalizedRoot)) {
            throw new Error(`Path traversal attempt detected: ${userPath}`);
        }
    }
    // Check for symbolic links in the path
    try {
        const realPath = fs.realpathSync(resolvedPath);
        const realRoot = fs.realpathSync(normalizedRoot);
        if (process.platform === 'win32') {
            if (!realPath.toLowerCase().startsWith(realRoot.toLowerCase())) {
                throw new Error(`Symbolic link escape attempt detected: ${userPath}`);
            }
        }
        else {
            if (!realPath.startsWith(realRoot)) {
                throw new Error(`Symbolic link escape attempt detected: ${userPath}`);
            }
        }
        return realPath;
    }
    catch (error) {
        // If file doesn't exist yet, that's OK - just return the resolved path
        if (error.code === 'ENOENT') {
            return resolvedPath;
        }
        throw error;
    }
}
/**
 * Validate that a path doesn't contain dangerous patterns
 *
 * @param userPath - The path to validate
 * @returns true if path is safe
 */
export function isPathSafe(userPath) {
    // Check for dangerous patterns
    const dangerousPatterns = [
        /\.\.[\\\/]/, // Parent directory traversal
        /^[\\\/]/, // Absolute path
        /^[a-zA-Z]:[\\\/]/, // Windows absolute path
        /[\x00-\x1f]/, // Control characters
        /[<>:"|?*]/ // Invalid Windows characters (optional, depends on OS)
    ];
    if (process.platform !== 'win32') {
        // Remove Windows-specific check for Unix systems
        dangerousPatterns.pop();
    }
    for (const pattern of dangerousPatterns) {
        if (pattern.test(userPath)) {
            return false;
        }
    }
    return true;
}
/**
 * Sanitize a filename to remove dangerous characters
 *
 * @param filename - The filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename) {
    // Remove path separators and null bytes
    let sanitized = filename.replace(/[\/\\]/g, '_').replace(/\x00/g, '');
    // Remove other dangerous characters based on platform
    if (process.platform === 'win32') {
        // Windows: remove reserved characters
        sanitized = sanitized.replace(/[<>:"|?*]/g, '_');
        // Remove reserved names
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4',
            'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2',
            'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
        if (reservedNames.includes(nameWithoutExt)) {
            sanitized = '_' + sanitized;
        }
    }
    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
    // Ensure filename is not empty
    if (!sanitized) {
        sanitized = 'unnamed';
    }
    return sanitized;
}
/**
 * Simple in-memory rate limiter
 */
export class RateLimiter {
    config;
    requests = new Map();
    constructor(config) {
        this.config = config;
    }
    /**
     * Check if a request should be allowed
     *
     * @param identifier - Unique identifier for the client (IP, session ID, etc.)
     * @returns true if request is allowed, false if rate limited
     */
    isAllowed(identifier) {
        const now = Date.now();
        const record = this.requests.get(identifier);
        if (!record || now > record.resetTime) {
            // Create new record or reset expired one
            this.requests.set(identifier, {
                count: 1,
                resetTime: now + this.config.windowMs
            });
            return true;
        }
        if (record.count < this.config.maxRequests) {
            record.count++;
            return true;
        }
        return false;
    }
    /**
     * Clean up expired records
     */
    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.requests) {
            if (now > record.resetTime) {
                this.requests.delete(key);
            }
        }
    }
    /**
     * Get rate limit headers for response
     */
    getHeaders(identifier) {
        const record = this.requests.get(identifier);
        if (!record) {
            return {
                'X-RateLimit-Limit': String(this.config.maxRequests),
                'X-RateLimit-Remaining': String(this.config.maxRequests),
                'X-RateLimit-Reset': String(Date.now() + this.config.windowMs)
            };
        }
        return {
            'X-RateLimit-Limit': String(this.config.maxRequests),
            'X-RateLimit-Remaining': String(Math.max(0, this.config.maxRequests - record.count)),
            'X-RateLimit-Reset': String(record.resetTime)
        };
    }
}
/**
 * Validate request size
 *
 * @param contentLength - Content-Length header value
 * @param maxSize - Maximum allowed size in bytes
 * @throws Error if content is too large
 */
export function validateRequestSize(contentLength, maxSize = 10 * 1024 * 1024) {
    if (!contentLength) {
        return;
    }
    const size = parseInt(contentLength, 10);
    if (isNaN(size)) {
        throw new Error('Invalid Content-Length header');
    }
    if (size > maxSize) {
        throw new Error(`Request body too large. Maximum size: ${maxSize} bytes`);
    }
}
//# sourceMappingURL=security.js.map