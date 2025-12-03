/**
 * HTTP Transport utilities for MCP SDK
 *
 * Wrapper around MCP SDK transport for easier setup
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AsyncLocalStorage } from 'async_hooks';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Logger, RequestContext } from './types.js';
/**
 * AsyncLocalStorage for per-request context
 *
 * This allows us to pass HTTP headers (like X-MCP-Project-Root)
 * through the async call stack to MCP handlers, even though
 * the official MCP SDK doesn't support custom context in handlers.
 */
export declare const requestContextStorage: AsyncLocalStorage<RequestContext>;
/**
 * Get current request context from AsyncLocalStorage
 * Returns undefined if called outside of a request context
 */
export declare function getRequestContext(): RequestContext | undefined;
/**
 * Extract RequestContext from HTTP headers
 */
export declare function extractRequestContext(req: IncomingMessage): RequestContext;
/**
 * Simple HTTP transport (request-response, no SSE)
 * Compatible with Cursor and other MCP clients that expect standard JSON-RPC over HTTP POST
 *
 * This transport creates a transport object compatible with MCP SDK's Server.connect() method
 */
export declare function createSimpleHttpTransport(mcpPath: string, httpServer: import('http').Server, logger?: Logger): {
    start: () => Promise<void>;
    send: (message: any) => Promise<void>;
    close: () => Promise<void>;
    getConnectionsCount: () => number;
    onmessage?: (message: any) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;
};
/**
 * Transport manager for handling multiple MCP connections
 */
export declare class TransportManager {
    private mcpPath;
    private logger?;
    private transports;
    private connectionCounter;
    private mcpServer;
    constructor(mcpPath: string, logger?: Logger | undefined);
    /**
     * Set the MCP server instance
     */
    setServer(server: Server): void;
    /**
     * Handle incoming HTTP request and create SSE transport
     */
    handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
    /**
     * Get active connections count
     */
    getConnectionsCount(): number;
    /**
     * Close all active transports
     */
    closeAll(): Promise<void>;
}
/**
 * Legacy function for backward compatibility
 * @deprecated Use TransportManager instead
 */
export declare function createHttpTransport(mcpPath: string, logger?: Logger): {
    handleRequest: (req: IncomingMessage, res: ServerResponse) => void;
    connect: (server: Server) => Promise<void>;
};
/**
 * Parse request body as JSON
 */
export declare function parseRequestBody<T = unknown>(req: IncomingMessage): Promise<T>;
/**
 * CORS configuration
 */
export interface CorsOptions {
    origin?: string | string[] | ((origin: string) => boolean);
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
}
/**
 * Get CORS headers based on options
 */
export declare function getCorsHeaders(corsOptions?: CorsOptions, requestOrigin?: string): Record<string, string>;
/**
 * Send JSON response with configurable CORS
 */
export declare function sendJsonResponse(res: ServerResponse, statusCode: number, data: unknown, corsOptions?: CorsOptions, additionalHeaders?: Record<string, string>): void;
//# sourceMappingURL=transport.d.ts.map