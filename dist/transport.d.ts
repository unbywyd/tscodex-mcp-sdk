/**
 * HTTP Transport utilities for MCP SDK
 *
 * Wrapper around MCP SDK transport for easier setup
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Logger } from './types.js';
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