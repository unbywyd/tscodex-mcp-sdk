/**
 * HTTP Transport utilities for MCP SDK
 * 
 * Wrapper around MCP SDK transport for easier setup
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Logger } from './types.js';

/**
 * Simple HTTP transport (request-response, no SSE)
 * Compatible with Cursor and other MCP clients that expect standard JSON-RPC over HTTP POST
 * 
 * This transport creates a transport object compatible with MCP SDK's Server.connect() method
 */
export function createSimpleHttpTransport(
  mcpPath: string,
  httpServer: import('http').Server,
  logger?: Logger
): {
  start: () => Promise<void>;
  send: (message: any) => Promise<void>;
  close: () => Promise<void>;
  getConnectionsCount: () => number;
  onmessage?: (message: any) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
} {
  let currentResponse: ServerResponse | null = null;
  let responseTimeout: NodeJS.Timeout | null = null;
  
  const transport = {
    onmessage: undefined as ((message: any) => void) | undefined,
    onclose: undefined as (() => void) | undefined,
    onerror: undefined as ((error: Error) => void) | undefined,
    
    async start() {
      httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
        const pathname = req.url ? req.url.split('?')[0] : '';
        
        if (logger) {
          logger.debug(`SimpleHTTP: method=${req.method}, pathname=${pathname}, mcpPath=${mcpPath}`);
        }
        
        // Only handle POST requests to the specified path
        // Don't send 404 here - let other handlers (extension endpoints) process the request
        if (req.method !== 'POST' || pathname !== mcpPath) {
          if (logger) {
            logger.debug(`SimpleHTTP: skipping (method=${req.method}, pathname=${pathname}), letting extension endpoints handle it`);
          }
          // Don't send response - let extension endpoints handle it
          // Just return without doing anything
          return;
        }
        
        if (logger) {
          logger.debug(`SimpleHTTP: handling MCP request on ${mcpPath}`);
        }
        
        try {
          // Parse request body
          const body = await parseRequestBody<{ method?: string; id?: any }>(req);
          
          const method = body.method || 'unknown';
          
          // Check if this is a notification
          const hasId = body.hasOwnProperty('id') && body.id !== null && body.id !== undefined;
          const isNotification = !hasId || (typeof method === 'string' && method.startsWith('notifications/'));
          
          // For notifications, send immediate empty response
          if (isNotification) {
            if (logger) {
              logger.debug(`SimpleHTTP: notification ${method}`);
            }
            
            // Process the notification asynchronously
            if (transport.onmessage) {
              transport.onmessage(body);
            }
            
            // Send immediate empty response for notifications
            res.statusCode = 204;
            res.end();
            return;
          }
          
          // For regular requests, store the response object
          if (logger) {
            logger.debug(`SimpleHTTP: request ${method}`);
          }
          currentResponse = res;
          
          // Set a timeout to prevent hanging connections (60 seconds)
          const timeoutMs = 60000;
          responseTimeout = setTimeout(() => {
            if (logger) {
              logger.warn(`SimpleHTTP: timeout for ${method}`);
            }
            if (currentResponse) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32603,
                  message: 'Request timeout',
                  data: `Method ${method} did not respond within ${timeoutMs / 1000} seconds`
                },
                id: body.id || null
              }));
              currentResponse = null;
            }
          }, timeoutMs);
          
          // Pass the message to the MCP server
          if (transport.onmessage) {
            transport.onmessage(body as any);
          }
        } catch (error) {
          if (logger) {
            logger.error('SimpleHTTP: Error handling request', error);
          }
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : String(error)
            },
            id: null
          }));
        }
      });
    },
    
    // Send a message (used to send responses)
    async send(message: any): Promise<void> {
      if (logger) {
        logger.debug('SimpleHTTP: sending response');
      }
      
      // Clear timeout if set
      if (responseTimeout) {
        clearTimeout(responseTimeout);
        responseTimeout = null;
      }
      
      // Send the response if we have a response object
      if (currentResponse) {
        currentResponse.statusCode = 200;
        currentResponse.setHeader('Content-Type', 'application/json');
        currentResponse.end(JSON.stringify(message));
        currentResponse = null;
      }
      
      return Promise.resolve();
    },
    
    // Close the transport
    async close(): Promise<void> {
      if (logger) {
        logger.debug('SimpleHTTP: closing transport');
      }
      
      // Clear any pending timeout
      if (responseTimeout) {
        clearTimeout(responseTimeout);
        responseTimeout = null;
      }
      
      // Clear response object
      currentResponse = null;
      
      if (transport.onclose) {
        transport.onclose();
      }
      return Promise.resolve();
    },
    
    // Get active connections count (for simple HTTP, it's stateless - return 0 or 1 if there's a pending response)
    getConnectionsCount(): number {
      return currentResponse ? 1 : 0;
    }
  };
  
  return transport;
}

/**
 * Transport manager for handling multiple MCP connections
 */
export class TransportManager {
  private transports = new Map<string, SSEServerTransport>();
  private connectionCounter = 0;
  private mcpServer: Server | null = null;
  
  constructor(
    private mcpPath: string,
    private logger?: Logger
  ) {}

  /**
   * Set the MCP server instance
   */
  setServer(server: Server): void {
    this.mcpServer = server;
  }

  /**
   * Handle incoming HTTP request and create SSE transport
   */
  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Parse URL to handle query strings - extract pathname before '?'
    const pathname = req.url ? req.url.split('?')[0] : '';
    
    if (this.logger) {
      this.logger.debug(`Transport handleRequest: method=${req.method}, url=${req.url}, pathname=${pathname}, mcpPath=${this.mcpPath}`);
    }
    
    // SSE can use both GET and POST methods
    // Cursor typically uses POST for initial connection and GET for SSE stream
    if (pathname !== this.mcpPath) {
      if (this.logger) {
        this.logger.debug(`Request rejected: pathname=${pathname} !== mcpPath=${this.mcpPath}`);
      }
      return;
    }
    
    if (req.method !== 'POST' && req.method !== 'GET') {
      if (this.logger) {
        this.logger.debug(`Request rejected: unsupported method=${req.method} (expected POST or GET)`);
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
      
    } catch (error) {
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
  getConnectionsCount(): number {
    return this.transports.size;
  }

  /**
   * Close all active transports
   */
  async closeAll(): Promise<void> {
    for (const [id, transport] of this.transports) {
      try {
        // SSE transports don't have a close method, but we clear our references
        this.transports.delete(id);
      } catch (error) {
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
export function createHttpTransport(
  mcpPath: string,
  logger?: Logger
): {
  handleRequest: (req: IncomingMessage, res: ServerResponse) => void;
  connect: (server: Server) => Promise<void>;
} {
  const manager = new TransportManager(mcpPath, logger);
  
  return {
    handleRequest: (req: IncomingMessage, res: ServerResponse) => {
      // This is async but we can't await in the legacy API
      manager.handleRequest(req, res).catch(error => {
        if (logger) {
          logger.error('Transport handling error:', error);
        }
      });
    },
    connect: async (server: Server) => {
      manager.setServer(server);
    }
  };
}

/**
 * Parse request body as JSON
 */
export async function parseRequestBody<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    
    req.on('error', reject);
  });
}

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
export function getCorsHeaders(corsOptions?: CorsOptions, requestOrigin?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  
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
    } else if (Array.isArray(corsOptions.origin)) {
      if (requestOrigin && corsOptions.origin.includes(requestOrigin)) {
        headers['Access-Control-Allow-Origin'] = requestOrigin;
      }
    } else if (typeof corsOptions.origin === 'function') {
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
export function sendJsonResponse(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
  corsOptions?: CorsOptions,
  additionalHeaders?: Record<string, string>
): void {
  const headers = {
    'Content-Type': 'application/json',
    ...getCorsHeaders(corsOptions),
    ...additionalHeaders
  };
  
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}
