/**
 * HTTP Transport utilities for MCP SDK
 *
 * Wrapper around MCP SDK transport for easier setup
 */
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
/**
 * Transport manager for handling multiple MCP connections
 */
export class TransportManager {
    mcpPath;
    logger;
    transports = new Map();
    connectionCounter = 0;
    mcpServer = null;
    constructor(mcpPath, logger) {
        this.mcpPath = mcpPath;
        this.logger = logger;
    }
    /**
     * Set the MCP server instance
     */
    setServer(server) {
        this.mcpServer = server;
    }
    /**
     * Handle incoming HTTP request and create SSE transport
     */
    async handleRequest(req, res) {
        // Parse URL to handle query strings - extract pathname before '?'
        const pathname = req.url ? req.url.split('?')[0] : '';
        if (this.logger) {
            this.logger.debug(`Transport handleRequest: method=${req.method}, url=${req.url}, pathname=${pathname}, mcpPath=${this.mcpPath}`);
        }
        if (pathname !== this.mcpPath || req.method !== 'POST') {
            if (this.logger) {
                this.logger.debug(`Request rejected: pathname=${pathname} !== mcpPath=${this.mcpPath} or method=${req.method} !== POST`);
            }
            return;
        }
        if (!this.mcpServer) {
            if (this.logger) {
                this.logger.error('MCP server not initialized when handling request');
            }
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'MCP server not initialized' }));
            return;
        }
        const connectionId = `conn-${++this.connectionCounter}`;
        try {
            if (this.logger) {
                this.logger.debug(`Creating SSE transport for connection ${connectionId}`);
            }
            // Create new SSE transport for this connection
            const transport = new SSEServerTransport(this.mcpPath, res);
            this.transports.set(connectionId, transport);
            if (this.logger) {
                this.logger.debug(`New MCP connection ${connectionId} on ${this.mcpPath}`);
            }
            // Connect transport to MCP server immediately
            await this.mcpServer.connect(transport);
            if (this.logger) {
                this.logger.info(`MCP connection ${connectionId} established`);
            }
            // Handle disconnection
            res.on('close', () => {
                this.transports.delete(connectionId);
                if (this.logger) {
                    this.logger.debug(`MCP connection ${connectionId} closed`);
                }
            });
            res.on('error', (error) => {
                this.transports.delete(connectionId);
                if (this.logger) {
                    this.logger.error(`MCP connection ${connectionId} error:`, error);
                }
            });
        }
        catch (error) {
            this.transports.delete(connectionId);
            if (this.logger) {
                this.logger.error(`Failed to establish MCP connection ${connectionId}:`, error);
            }
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to establish MCP connection',
                message: error instanceof Error ? error.message : String(error)
            }));
        }
    }
    /**
     * Get active connections count
     */
    getConnectionsCount() {
        return this.transports.size;
    }
    /**
     * Close all active transports
     */
    async closeAll() {
        for (const [id, transport] of this.transports) {
            try {
                // SSE transports don't have a close method, but we clear our references
                this.transports.delete(id);
            }
            catch (error) {
                if (this.logger) {
                    this.logger.error(`Error closing transport ${id}:`, error);
                }
            }
        }
    }
}
/**
 * Legacy function for backward compatibility
 * @deprecated Use TransportManager instead
 */
export function createHttpTransport(mcpPath, logger) {
    const manager = new TransportManager(mcpPath, logger);
    return {
        handleRequest: (req, res) => {
            // This is async but we can't await in the legacy API
            manager.handleRequest(req, res).catch(error => {
                if (logger) {
                    logger.error('Transport handling error:', error);
                }
            });
        },
        connect: async (server) => {
            manager.setServer(server);
        }
    };
}
/**
 * Parse request body as JSON
 */
export async function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            }
            catch (error) {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}
/**
 * Get CORS headers based on options
 */
export function getCorsHeaders(corsOptions, requestOrigin) {
    const headers = {};
    if (!corsOptions) {
        // Default permissive CORS (allow all)
        headers['Access-Control-Allow-Origin'] = '*';
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        return headers;
    }
    // Handle origin
    if (corsOptions.origin) {
        if (typeof corsOptions.origin === 'string') {
            headers['Access-Control-Allow-Origin'] = corsOptions.origin;
        }
        else if (Array.isArray(corsOptions.origin)) {
            if (requestOrigin && corsOptions.origin.includes(requestOrigin)) {
                headers['Access-Control-Allow-Origin'] = requestOrigin;
            }
        }
        else if (typeof corsOptions.origin === 'function') {
            if (requestOrigin && corsOptions.origin(requestOrigin)) {
                headers['Access-Control-Allow-Origin'] = requestOrigin;
            }
        }
    }
    // Handle methods
    if (corsOptions.methods) {
        headers['Access-Control-Allow-Methods'] = corsOptions.methods.join(', ');
    }
    // Handle headers
    if (corsOptions.headers) {
        headers['Access-Control-Allow-Headers'] = corsOptions.headers.join(', ');
    }
    // Handle credentials
    if (corsOptions.credentials) {
        headers['Access-Control-Allow-Credentials'] = 'true';
    }
    return headers;
}
/**
 * Send JSON response with configurable CORS
 */
export function sendJsonResponse(res, statusCode, data, corsOptions, additionalHeaders) {
    const headers = {
        'Content-Type': 'application/json',
        ...getCorsHeaders(corsOptions),
        ...additionalHeaders
    };
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
}
//# sourceMappingURL=transport.js.map