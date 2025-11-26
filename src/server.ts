/**
 * McpServer - Main class for creating MCP servers
 * 
 * This class encapsulates all MCP server logic:
 * - MCP server initialization
 * - Configuration management
 * - Tool/Resource/Prompt registration
 * - HTTP transport
 * - Extension endpoints
 * - Health checks
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'http';
import { EventEmitter } from 'events';
import { type TSchema, Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type {
  McpServerOptions,
  ToolHandler,
  ResourceHandler,
  PromptHandler,
  ToolContext,
  ResourceContext,
  PromptContext,
  ToolResult,
  ResourceResult,
  PromptResult,
  ToolConfig,
  ResourceConfig,
  PromptConfig,
  Logger,
  ErrorHandler,
  ErrorHandlerContext
} from './types.js';
import { validateConfig, updateConfig } from './config.js';
import { createHttpTransport, parseRequestBody, sendJsonResponse } from './transport.js';
import type { HealthResponse, UpdateProjectRootRequest, UpdateProjectRootResponse, ServerMetadata } from './extension.js';
import { TransportManager, type CorsOptions } from './transport.js';
import { RateLimiter, validateRequestSize, filterMcpPublicConfig, type RateLimitConfig } from './security.js';
import type { ServerHttpOptions, ServerSecurityOptions, ServerHandlerOptions } from './types.js';
import { parseServerCliArgs } from './cli-parser.js';

interface ToolDefinition<
  TSchemaType extends TSchema,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  handler: ToolHandler<TSchemaType, TConfig, TSession>;
  schema: TSchemaType;
  description: string;
  access?: string[];
}

interface ResourceDefinition<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  handler: ResourceHandler<TConfig, TSession>;
  name: string;
  description: string;
  mimeType?: string;
  access?: string[];
}

interface PromptDefinition<
  TSchemaType extends TSchema,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  handler: PromptHandler<TSchemaType, TConfig, TSession>;
  description: string;
  arguments?: TSchemaType;
  access?: string[];
}

/**
 * Main MCP Server class
 */
export class McpServer<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TRoles extends string = never,
  TSession extends Record<string, unknown> = Record<string, unknown>
> extends EventEmitter {
  private mcpServer: Server;
  private httpServer: HttpServer;
  private transportManager: TransportManager;
  private config: TConfig;
  private secrets: Map<string, string> = new Map();
  private projectRoot?: string;
  private session?: TSession;

  private tools = new Map<string, ToolDefinition<any, TConfig, TSession>>();
  private resources = new Map<string, ResourceDefinition<TConfig, TSession>>();
  private prompts = new Map<string, PromptDefinition<any, TConfig, TSession>>();

  private port: number;
  private host: string;
  private mcpPath: string;
  private corsOptions?: CorsOptions;
  private httpOptions: ServerHttpOptions;
  private securityOptions: ServerSecurityOptions;
  private handlerOptions: ServerHandlerOptions;
  private rateLimiter?: RateLimiter;
  private logger?: Logger;
  private errorHandler?: ErrorHandler<TConfig, TSession>;
  private signalHandlersInstalled = false;
  private sigintHandler?: () => void;
  private sigtermHandler?: () => void;
  private resourcePrefix: string;
  private startTime: number;
  private isRunning = false;
  private isInitialized = false;
  private protocolVersion = '1.0.0';
  private rateLimiterCleanupInterval?: NodeJS.Timeout;

  constructor(private options: McpServerOptions<TConfig, TRoles, TSession>) {
    super();

    // Check for --meta flag - SDK handles this completely
    const isMetaMode = process.argv.includes('--meta') || process.argv.includes('--metadata');

    // Validate required fields
    if (!options.name || typeof options.name !== 'string') {
      throw new Error('McpServer: "name" is required and must be a string');
    }
    if (!options.version || typeof options.version !== 'string') {
      throw new Error('McpServer: "version" is required and must be a string');
    }
    if (!options.description || typeof options.description !== 'string') {
      throw new Error('McpServer: "description" is required and must be a string');
    }

    // Generate or validate resource prefix (ID)
    this.resourcePrefix = this.generateResourcePrefix(options.name, options.id);

    // Parse CLI arguments for server settings
    const cliArgs = parseServerCliArgs();

    // Read parameters with priority: MCP_* env vars -> env vars without prefix -> CLI args -> defaults
    // Priority: process.env.MCP_HOST -> process.env.HOST -> CLI --host -> default
    this.host = process.env.MCP_HOST || process.env.HOST || cliArgs.host || '127.0.0.1';

    // Priority: process.env.MCP_PORT -> process.env.PORT -> CLI --port -> default
    const portValue = process.env.MCP_PORT || process.env.PORT || cliArgs.port || '3848';
    this.port = parseInt(String(portValue), 10);

    // Priority: process.env.MCP_PROJECT_ROOT -> process.env.CURSOR_WORKSPACE -> process.env.PROJECT_ROOT -> CLI --project-root -> undefined
    this.projectRoot = process.env.MCP_PROJECT_ROOT || process.env.CURSOR_WORKSPACE || process.env.PROJECT_ROOT || cliArgs.projectRoot || undefined;

    // Server settings
    // Priority: process.env.MCP_PATH -> process.env.PATH (but skip system PATH) -> CLI --mcp-path -> options.mcpPath -> default
    // Note: We skip process.env.PATH for mcpPath as it's usually a system variable
    this.mcpPath = process.env.MCP_PATH || cliArgs.mcpPath || options.mcpPath || '/mcp';
    // CORS defaults to permissive (*) if not specified
    this.corsOptions = options.corsOptions ?? undefined;
    // SDK manages logger: disable in meta mode for clean JSON output
    // This ensures no logs are printed when --meta flag is used
    this.logger = isMetaMode ? undefined : options.logger;
    this.errorHandler = options.errorHandler;
    this.startTime = Date.now();

    // HTTP options with defaults
    this.httpOptions = {
      requestTimeout: 5 * 60 * 1000, // 5 minutes
      keepAliveTimeout: 5000,
      maxHeadersCount: 2000,
      maxHeaderSize: 16384,
      keepAlive: true,
      ...options.httpOptions
    };

    // Security options with defaults
    this.securityOptions = {
      maxRequestBodySize: 10 * 1024 * 1024, // 10MB
      validateRequestSize: true,
      ...options.securityOptions
    };

    // Handler options with defaults (5 minutes)
    const defaultTimeout = 5 * 60 * 1000; // 5 minutes
    this.handlerOptions = {
      toolHandlerTimeout: defaultTimeout,
      resourceHandlerTimeout: defaultTimeout,
      promptHandlerTimeout: defaultTimeout,
      ...options.handlerOptions
    };

    // Initialize rate limiter if configured
    if (this.securityOptions.rateLimit) {
      this.rateLimiter = new RateLimiter(this.securityOptions.rateLimit);
    }

    // Initialize configuration (will be filled in initialize())
    this.config = {} as TConfig;

    // Create MCP Server
    // Note: protocolVersion is stored separately as MCP SDK doesn't support it in ServerOptions
    this.mcpServer = new Server(
      {
        name: options.name,
        version: options.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Create HTTP Server with options
    this.httpServer = createServer();
    this.applyHttpOptions();

    // Create Transport Manager
    this.transportManager = new TransportManager(this.mcpPath, this.logger);

    if (this.logger) {
      this.logger.info(`McpServer created: ${options.name} v${options.version}`);
      this.logger.debug(`Port: ${this.port}, Host: ${this.host}`);
      this.logger.debug(`Project Root: ${this.projectRoot || 'not set'}`);
    }
  }

  /**
   * Initialize server: load config, load session, filter by access, setup endpoints, register handlers
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Server already initialized');
    }

    // SDK manages meta mode: ensure logger is disabled if --meta flag is present
    // This check ensures logger is disabled even if it was set before constructor
    const isMetaMode = process.argv.includes('--meta') || process.argv.includes('--metadata');
    if (isMetaMode) {
      this.logger = undefined;
    }

    try {
      // 1. Load configuration (FIRST!)
      await this.loadConfiguration();

      // 2. Load session (if auth is configured)
      if (this.options.auth) {
        await this.loadSession();
      }

      // 3. Filter tools/resources/prompts by access
      //    IMPORTANT: Called AFTER loadConfiguration!
      //    Guards have access to loaded configuration
      if (this.options.auth) {
        await this.filterByAccess();
      }

      // 4. Setup Extension endpoints (always enabled)
      this.setupExtensionEndpoints();

      // 5. Register default context resource (if not overridden by user)
      this.registerDefaultContextResource();

      // 6. Register default config update tool (if not overridden by user)
      this.registerDefaultConfigTool();

      // 7. Register MCP handlers (only filtered ones)
      this.registerMcpHandlers();

      // 7. Setup transport with MCP server
      this.transportManager.setServer(this.mcpServer);

      if (this.logger) {
        this.logger.info('McpServer initialized successfully');
      }

      this.isInitialized = true;

      // Setup rate limiter cleanup interval if rate limiter is enabled
      if (this.rateLimiter) {
        this.rateLimiterCleanupInterval = setInterval(
          () => this.rateLimiter!.cleanup(),
          60000 // Cleanup every minute
        );
      }

      this.emit('initialized');
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to initialize McpServer:', error);
      }
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Load session from MCP_AUTH_TOKEN environment variable
   * 
   * MCP_AUTH_TOKEN always contains a token/key (string), which is processed
   * by auth.loadSession() to get the full session object.
   */
  private async loadSession(): Promise<void> {
    if (!this.options.auth) {
      return;
    }

    try {
      const token = process.env.MCP_AUTH_TOKEN;

      if (!token) {
        if (this.options.auth.requireSession !== false) {
          throw new Error('Session is required but MCP_AUTH_TOKEN environment variable is not set');
        }
        // Session is optional, continue without it
        if (this.logger) {
          this.logger.debug('No auth token provided (optional)');
        }
        return;
      }

      // MCP_AUTH_TOKEN always contains a token/key (string), not a full session
      // Process token through loadSession function to get full session
      const sessionData = await this.options.auth.loadSession(token, {
        config: this.config,
        projectRoot: this.projectRoot
      });

      // Validate session via sessionSchema
      this.session = validateConfig<TSession>(
        sessionData,
        this.options.auth.sessionSchema
      );

      if (this.logger) {
        this.logger.info('Session loaded successfully');
        this.logger.debug('Session data:', Object.keys(this.session || {}));
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to load session:', error);
      }
      throw new Error(`Session loading failed: ${error}`);
    }
  }

  /**
   * Filter tools/resources/prompts by access control
   * Called AFTER loadConfiguration() so guards have access to config
   */
  private async filterByAccess(): Promise<void> {
    if (!this.options.auth || !this.session) {
      // If no auth or no session, remove all tools/resources/prompts with access requirements
      for (const [name, def] of this.tools.entries()) {
        if (def.access && def.access.length > 0) {
          this.tools.delete(name);
          if (this.logger) {
            this.logger.debug(`Tool "${name}" removed: requires access but no session`);
          }
        }
      }
      for (const [uri, def] of this.resources.entries()) {
        if (def.access && def.access.length > 0) {
          this.resources.delete(uri);
          if (this.logger) {
            this.logger.debug(`Resource "${uri}" removed: requires access but no session`);
          }
        }
      }
      for (const [name, def] of this.prompts.entries()) {
        if (def.access && def.access.length > 0) {
          this.prompts.delete(name);
          if (this.logger) {
            this.logger.debug(`Prompt "${name}" removed: requires access but no session`);
          }
        }
      }
      return;
    }

    // Create guard context with loaded configuration
    const guardContext = {
      config: this.config,
      projectRoot: this.projectRoot,
      server: this as McpServer<TConfig, TRoles, TSession>
    };

    // Filter tools
    for (const [name, def] of this.tools.entries()) {
      if (def.access && def.access.length > 0) {
        // Check access for each role
        const accessChecks = await Promise.all(
          def.access.map(async (role) => {
            const guard = this.options.auth!.roles[role as TRoles];
            if (!guard) {
              if (this.logger) {
                this.logger.warn(`Guard for role "${role}" not found`);
              }
              return false;
            }
            // Guard receives session AND context with configuration
            return await guard(this.session!, guardContext);
          })
        );

        const hasAccess = accessChecks.some(result => result === true);

        if (!hasAccess) {
          this.tools.delete(name);
          if (this.logger) {
            this.logger.debug(`Tool "${name}" removed: access denied`);
          }
        }
      }
    }

    // Filter resources
    for (const [uri, def] of this.resources.entries()) {
      if (def.access && def.access.length > 0) {
        const accessChecks = await Promise.all(
          def.access.map(async (role) => {
            const guard = this.options.auth!.roles[role as TRoles];
            if (!guard) {
              if (this.logger) {
                this.logger.warn(`Guard for role "${role}" not found`);
              }
              return false;
            }
            return await guard(this.session!, guardContext);
          })
        );

        const hasAccess = accessChecks.some(result => result === true);

        if (!hasAccess) {
          this.resources.delete(uri);
          if (this.logger) {
            this.logger.debug(`Resource "${uri}" removed: access denied`);
          }
        }
      }
    }

    // Filter prompts
    for (const [name, def] of this.prompts.entries()) {
      if (def.access && def.access.length > 0) {
        const accessChecks = await Promise.all(
          def.access.map(async (role) => {
            const guard = this.options.auth!.roles[role as TRoles];
            if (!guard) {
              if (this.logger) {
                this.logger.warn(`Guard for role "${role}" not found`);
              }
              return false;
            }
            return await guard(this.session!, guardContext);
          })
        );

        const hasAccess = accessChecks.some(result => result === true);

        if (!hasAccess) {
          this.prompts.delete(name);
          if (this.logger) {
            this.logger.debug(`Prompt "${name}" removed: access denied`);
          }
        }
      }
    }

    if (this.logger) {
      this.logger.info(`Access filtering completed: ${this.tools.size} tools, ${this.resources.size} resources, ${this.prompts.size} prompts available`);
    }
  }

  /**
   * Extract secrets from environment variables
   * Secrets are variables with SECRET_ prefix
   * They are extracted and removed from process.env to prevent them from being included in config
   */
  private extractSecretsFromEnv(): void {
    this.secrets.clear();

    // Extract all SECRET_* variables from process.env
    const secretKeys: string[] = [];
    for (const [envKey, value] of Object.entries(process.env)) {
      if (envKey.startsWith('SECRET_') && value !== undefined) {
        this.secrets.set(envKey, value);
        secretKeys.push(envKey);
      }
    }

    // Remove secrets from process.env to prevent them from being included in config
    // This ensures secrets don't leak into public configuration
    for (const key of secretKeys) {
      delete process.env[key];
    }

    if (this.logger && this.secrets.size > 0) {
      this.logger.debug(`Extracted ${this.secrets.size} secrets from ENV:`, Array.from(this.secrets.keys()));
    }
  }

  /**
   * Load and merge configuration
   */
  private async loadConfiguration(): Promise<void> {
    try {
      // 0. Extract secrets from ENV first (before loading config)
      // This ensures secrets don't get included in public configuration
      this.extractSecretsFromEnv();

      // 1. Read configuration from Extension
      const extensionConfig = process.env.MCP_CONFIG
        ? JSON.parse(process.env.MCP_CONFIG)
        : {};

      if (this.logger) {
        this.logger.debug('Extension config loaded:', Object.keys(extensionConfig));
      }

      // 2. Parse local config from CLI, ENV, and file (if configSchema or configFile provided)
      let localConfig: Partial<TConfig> = {};

      if (this.options.configSchema || this.options.configFile) {
        // Use SDK's built-in config loader
        const { loadConfig } = await import('./config-loader.js');
        const parsedConfig = await loadConfig({
          schema: this.options.configSchema,
          configFile: this.options.configFile
        });
        localConfig = parsedConfig as Partial<TConfig>;

        if (this.logger) {
          this.logger.debug('Parsed config from CLI/ENV/file:', Object.keys(localConfig));
        }
      }

      // 3. Call loadConfig callback if provided (for custom processing)
      if (this.options.loadConfig) {
        localConfig = await this.options.loadConfig(localConfig);
        if (this.logger) {
          this.logger.debug('Processed config from loadConfig:', Object.keys(localConfig));
        }
      }

      // 4. Merge: Extension config takes priority (deep merge)
      const mergedConfig = updateConfig(
        localConfig as TConfig,
        extensionConfig
      );

      // 5. Validate via configSchema (strict validation after merge)
      if (this.options.configSchema) {
        this.config = validateConfig<TConfig>(
          mergedConfig,
          this.options.configSchema
        );
        if (this.logger) {
          this.logger.info('Configuration validated successfully');
        }
      } else {
        this.config = mergedConfig;
      }

    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to load configuration:', error);
      }
      throw new Error(`Configuration loading failed: ${error}`);
    }
  }

  /**
   * Apply HTTP server options
   */
  private applyHttpOptions(): void {
    if (this.httpOptions.requestTimeout !== undefined) {
      this.httpServer.timeout = this.httpOptions.requestTimeout;
    }
    if (this.httpOptions.keepAliveTimeout !== undefined) {
      this.httpServer.keepAliveTimeout = this.httpOptions.keepAliveTimeout;
    }
    if (this.httpOptions.maxHeadersCount !== undefined) {
      this.httpServer.maxHeadersCount = this.httpOptions.maxHeadersCount;
    }
    // Note: maxHeaderSize and keepAlive are not directly settable on HTTP Server
    // They are handled by Node.js internally or via request headers
  }

  /**
   * Setup Extension endpoints (health, project-root, config)
   */
  private setupExtensionEndpoints(): void {
    this.httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
      try {
        // Validate request size
        if (this.securityOptions.validateRequestSize && req.headers['content-length']) {
          try {
            validateRequestSize(req.headers['content-length'], this.securityOptions.maxRequestBodySize);
          } catch (error) {
            sendJsonResponse(res, 413, {
              error: 'Request Entity Too Large',
              message: error instanceof Error ? error.message : String(error)
            }, this.corsOptions);
            return;
          }
        }

        // Rate limiting
        if (this.rateLimiter) {
          const clientId = req.socket.remoteAddress || 'unknown';
          if (!this.rateLimiter.isAllowed(clientId)) {
            const headers = this.rateLimiter.getHeaders(clientId);
            sendJsonResponse(res, 429, {
              error: 'Too Many Requests',
              message: this.securityOptions.rateLimit?.message || 'Rate limit exceeded'
            }, this.corsOptions, headers);
            return;
          }
        }

        // Hello endpoint (health check with extended info)
        if (req.url === '/health' && req.method === 'GET') {
          this.hello(req, res);
          return;
        }

        // Update project root
        if (req.url === '/gateway/config/project-root' && req.method === 'POST') {
          await this.handleUpdateProjectRoot(req, res);
          return;
        }

        // Get config
        if (req.url === '/gateway/config/current' && req.method === 'GET') {
          this.handleGetConfig(req, res);
          return;
        }

        // Get metadata
        if (req.url === '/gateway/metadata' && req.method === 'GET') {
          this.handleGetMetadata(req, res);
          return;
        }

        // Update config
        if (req.url === '/gateway/config' && req.method === 'POST') {
          await this.handleUpdateConfig(req, res);
          return;
        }

        // CORS preflight
        if (req.method === 'OPTIONS') {
          sendJsonResponse(res, 200, {}, this.corsOptions);
          return;
        }

        // MCP transport endpoint
        if (req.url === this.mcpPath) {
          await this.transportManager.handleRequest(req, res);
          return;
        }

        // 404 Not Found
        sendJsonResponse(res, 404, { error: 'Not Found' }, this.corsOptions);
      } catch (error) {
        if (this.logger) {
          this.logger.error('Request handling error:', error);
        }
        sendJsonResponse(res, 500, { error: 'Internal Server Error' }, this.corsOptions);
      }
    });

    if (this.logger) {
      this.logger.debug('Extension endpoints configured');
    }
  }

  /**
   * Hello endpoint - provides server information, MCP protocol details, and health status
   */
  private hello(_req: IncomingMessage, res: ServerResponse): void {
    const uptime = (Date.now() - this.startTime) / 1000;
    const response: HealthResponse = {
      status: 'ok',
      server: this.options.name,
      version: this.options.version,
      description: this.options.description,
      uptime,
      connections: this.transportManager.getConnectionsCount(),
      protocolVersion: this.protocolVersion,
      protocol: {
        name: 'Model Context Protocol',
        version: this.protocolVersion,
        description: 'MCP is a protocol for connecting AI assistants to external data sources and tools. It enables secure, standardized communication between AI applications and various services.'
      },
      endpoints: {
        mcp: `http://${this.host}:${this.port}${this.mcpPath}`,
        health: `http://${this.host}:${this.port}/health`,
        metadata: `http://${this.host}:${this.port}/gateway/metadata`,
        config: `http://${this.host}:${this.port}/gateway/config/current`,
        updateConfig: `http://${this.host}:${this.port}/gateway/config`,
        projectRoot: `http://${this.host}:${this.port}/gateway/config/project-root`
      },
      auth: this.options.auth ? {
        required: this.options.auth.requireSession !== false,
        session: this.session,
        sessionValid: !!this.session
      } : undefined
    };

    sendJsonResponse(res, 200, response, this.corsOptions);

    if (this.logger) {
      this.logger.debug('Hello endpoint requested');
    }
  }

  /**
   * Handle update project root endpoint
   */
  private async handleUpdateProjectRoot(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    try {
      const body = await parseRequestBody(req) as UpdateProjectRootRequest;

      if (!body.projectRoot || typeof body.projectRoot !== 'string') {
        sendJsonResponse(res, 400, {
          error: 'Invalid request: projectRoot is required and must be a string'
        }, this.corsOptions);
        return;
      }

      const previousRoot = this.projectRoot;
      this.projectRoot = body.projectRoot;

      const response: UpdateProjectRootResponse = {
        success: true,
        message: 'Project root updated successfully',
        previousRoot,
        newRoot: this.projectRoot
      };

      sendJsonResponse(res, 200, response, this.corsOptions);

      if (this.logger) {
        this.logger.info(`Project root updated: ${previousRoot} -> ${this.projectRoot}`);
      }

      this.emit('projectRootChanged', this.projectRoot, previousRoot);
    } catch (error) {
      sendJsonResponse(res, 500, {
        error: 'Failed to update project root',
        message: error instanceof Error ? error.message : String(error)
      }, this.corsOptions);
    }
  }

  /**
   * Handle get config endpoint
   */
  private handleGetConfig(_req: IncomingMessage, res: ServerResponse): void {
    // Return public configuration (secrets are stored separately and not included)
    // All config is public - secrets are accessed via context.secrets
    sendJsonResponse(res, 200, this.config, this.corsOptions);

    if (this.logger) {
      this.logger.debug('Config requested');
    }
  }

  /**
   * Handle get metadata endpoint
   * Returns server metadata including tools, resources, prompts, and configuration schema
   */
  private handleGetMetadata(_req: IncomingMessage, res: ServerResponse): void {
    const metadata = this.getMetadata();
    sendJsonResponse(res, 200, metadata, this.corsOptions);

    if (this.logger) {
      this.logger.debug('Metadata requested');
    }
  }

  /**
   * Handle update config endpoint
   */
  private async handleUpdateConfig(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await parseRequestBody<{ config: Partial<TConfig> }>(req);

      if (!body || !body.config) {
        sendJsonResponse(res, 400, {
          error: 'Invalid request',
          message: 'Config object is required'
        }, this.corsOptions);
        return;
      }

      // Update config (deep merge)
      const previousConfig = { ...this.config };
      this.config = updateConfig(this.config, body.config) as TConfig;

      // Validate if schema provided
      if (this.options.configSchema) {
        this.config = validateConfig<TConfig>(this.config, this.options.configSchema);
      }

      const response = {
        success: true,
        message: 'Configuration updated successfully',
        previousConfig,
        newConfig: this.config
      };

      sendJsonResponse(res, 200, response, this.corsOptions);

      if (this.logger) {
        this.logger.info('Configuration updated via gateway endpoint');
      }

      // Emit event for config change
      this.emit('configChanged', this.config, previousConfig);
    } catch (error) {
      sendJsonResponse(res, 500, {
        error: 'Failed to update configuration',
        message: error instanceof Error ? error.message : String(error)
      }, this.corsOptions);
    }
  }

  /**
   * Update configuration dynamically
   * Can be called at any time to update server configuration
   * 
   * @param newConfig - Partial configuration to merge with existing config
   * @returns Updated configuration
   */
  updateConfig(newConfig: Partial<TConfig>): TConfig {
    const previousConfig = { ...this.config };

    // Deep merge
    this.config = updateConfig(this.config, newConfig) as TConfig;

    // Validate if schema provided
    if (this.options.configSchema) {
      this.config = validateConfig<TConfig>(this.config, this.options.configSchema);
    }

    if (this.logger) {
      this.logger.info('Configuration updated programmatically');
    }

    // Emit event for config change
    this.emit('configChanged', this.config, previousConfig);

    return this.config;
  }

  /**
   * Wrap handler with timeout
   */
  private withTimeout<T>(
    handler: () => Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      handler(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${errorMessage} (timeout after ${timeoutMs}ms)`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Create context for handlers
   * 
   * Handlers receive:
   * - Public configuration (settings, no secrets) in context.config
   * - Secrets storage in context.secrets (Map with SECRET_* keys)
   * 
   * Secrets are extracted from ENV variables with SECRET_ prefix and stored separately
   * to prevent them from being included in public configuration.
   * 
   * @returns Context object with public config and secrets storage
   */
  private createContext(): ToolContext<TConfig, TSession> {
    return {
      config: this.config, // Public configuration (no secrets)
      secrets: this.secrets, // Secrets storage (Map<string, string>)
      projectRoot: this.projectRoot,
      server: this,
      session: this.session
    };
  }

  /**
   * Handle error through error handler middleware
   * Transforms errors into human-readable messages for Cursor
   */
  private handleError(
    error: unknown,
    errorContext: ErrorHandlerContext<TConfig, TSession>
  ): Error {
    if (this.errorHandler) {
      const result = this.errorHandler(error, errorContext);
      if (typeof result === 'string') {
        return new Error(result);
      }
      return result;
    }

    // Default error handling if no custom handler
    const errorMessage = error instanceof Error
      ? error.message
      : String(error);

    const typeName = errorContext.type === 'tool' ? 'tool'
      : errorContext.type === 'resource' ? 'resource'
        : 'prompt';

    return new Error(
      `An error occurred while executing ${typeName} "${errorContext.name}": ${errorMessage}`
    );
  }

  /**
   * Register MCP protocol handlers
   */
  private registerMcpHandlers(): void {
    // List Tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.entries()).map(([name, def]) => ({
          name,
          description: def.description,
          // Convert TypeBox schema to JSON Schema for MCP protocol
          inputSchema: this.typeboxToJsonSchema(def.schema)
        }))
      };
    });

    // Call Tool
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const toolDef = this.tools.get(name);

      if (!toolDef) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Validate parameters via TypeBox
      const errors = [...Value.Errors(toolDef.schema, args || {})];
      if (errors.length > 0) {
        throw new Error(`Invalid tool parameters: ${this.formatValidationErrors(errors)}`);
      }

      // Apply defaults and cast parameters
      const validatedParams = Value.Cast(toolDef.schema, args || {});

      // Create context with public config and secrets storage
      // Config is public (no secrets), secrets are accessed via context.secrets
      const context = this.createContext();

      if (this.logger) {
        this.logger.debug(`Tool called: ${name}`);
      }

      try {
        const result = await this.withTimeout(
          () => toolDef.handler(validatedParams, context),
          this.handlerOptions.toolHandlerTimeout!,
          `Tool "${name}" execution timeout`
        );
        this.emit('toolCalled', name, validatedParams, result);
        // MCP SDK expects the same type structure we return
        return result as any; // Type assertion needed due to MCP SDK type limitations
      } catch (error) {
        if (this.logger) {
          this.logger.error(`Tool ${name} failed:`, error);
        }
        this.emit('toolError', name, validatedParams, error);

        // Process error through middleware
        const processedError = this.handleError(error, {
          type: 'tool',
          name,
          params: validatedParams,
          context
        });
        throw processedError;
      }
    });

    // List Resources
    this.mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: Array.from(this.resources.entries()).map(([uri, def]) => ({
          uri,
          name: def.name,
          description: def.description,
          mimeType: def.mimeType || 'text/plain'
        }))
      };
    });

    // Read Resource
    this.mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const resourceDef = this.resources.get(uri);

      if (!resourceDef) {
        throw new Error(`Unknown resource: ${uri}`);
      }

      // Create context with public config and secrets storage
      // Config is public (no secrets), secrets are accessed via context.secrets
      const context = this.createContext();

      if (this.logger) {
        this.logger.debug(`Resource read: ${uri}`);
      }

      try {
        const result = await this.withTimeout(
          () => resourceDef.handler(uri, context),
          this.handlerOptions.resourceHandlerTimeout!,
          `Resource "${uri}" read timeout`
        );
        this.emit('resourceRead', uri, result);
        // MCP SDK expects the same type structure we return
        return result as any; // Type assertion needed due to MCP SDK type limitations
      } catch (error) {
        if (this.logger) {
          this.logger.error(`Resource ${uri} failed:`, error);
        }
        this.emit('resourceError', uri, error);

        // Process error through middleware
        const processedError = this.handleError(error, {
          type: 'resource',
          name: uri,
          params: { uri },
          context
        });
        throw processedError;
      }
    });

    // List Prompts
    this.mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: Array.from(this.prompts.entries()).map(([name, def]) => ({
          name,
          description: def.description,
          // Convert TypeBox schema to JSON Schema for MCP protocol
          arguments: def.arguments
            ? this.typeboxToJsonSchema(def.arguments)
            : undefined
        }))
      };
    });

    // Get Prompt
    this.mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const promptDef = this.prompts.get(name);

      if (!promptDef) {
        throw new Error(`Unknown prompt: ${name}`);
      }

      // Validate parameters via TypeBox (if schema provided)
      let validatedParams = args || {};
      if (promptDef.arguments) {
        const errors = [...Value.Errors(promptDef.arguments, args || {})];
        if (errors.length > 0) {
          throw new Error(`Invalid prompt parameters: ${this.formatValidationErrors(errors)}`);
        }
        // Apply defaults and cast parameters
        validatedParams = Value.Cast(promptDef.arguments, args || {});
      }

      // Create context with public config and secrets storage
      // Config is public (no secrets), secrets are accessed via context.secrets
      const context = this.createContext();

      if (this.logger) {
        this.logger.debug(`Prompt requested: ${name}`);
      }

      try {
        const result = await this.withTimeout(
          () => promptDef.handler(validatedParams, context),
          this.handlerOptions.promptHandlerTimeout!,
          `Prompt "${name}" execution timeout`
        );
        this.emit('promptCalled', name, validatedParams, result);
        // MCP SDK expects the same type structure we return
        return result as any; // Type assertion needed due to MCP SDK type limitations
      } catch (error) {
        if (this.logger) {
          this.logger.error(`Prompt ${name} failed:`, error);
        }
        this.emit('promptError', name, validatedParams, error);

        // Process error through middleware
        const processedError = this.handleError(error, {
          type: 'prompt',
          name,
          params: validatedParams,
          context
        });
        throw processedError;
      }
    });

    if (this.logger) {
      this.logger.debug('MCP handlers registered');
    }
  }

  /**
   * Register default context resource with server information
   * This resource provides server metadata similar to /health endpoint
   * User can override it by registering their own resource with URI "context"
   */
  private registerDefaultContextResource(): void {
    const contextUri = `${this.resourcePrefix}://context`;

    // Check if user already registered a context resource
    if (this.resources.has(contextUri)) {
      if (this.logger) {
        this.logger.debug('Default context resource skipped: user-defined resource already exists');
      }
      return;
    }

    // Register default context resource
    this.resources.set(contextUri, {
      handler: async (uri, context) => {
        const uptime = (Date.now() - this.startTime) / 1000;

        // Include public configuration (secrets are stored separately and not included)
        // All config is public - secrets are accessed via context.secrets
        const contextData = {
          server: this.options.name,
          version: this.options.version,
          description: this.options.description,
          id: this.resourcePrefix,
          uptime,
          connections: this.transportManager.getConnectionsCount(),
          protocolVersion: this.protocolVersion,
          protocol: {
            name: 'Model Context Protocol',
            version: this.protocolVersion,
            description: 'MCP is a protocol for connecting AI assistants to external data sources and tools. It enables secure, standardized communication between AI applications and various services.'
          },
          projectRoot: context.projectRoot,
          config: this.config, // Public configuration (secrets are stored separately)
          auth: this.options.auth ? {
            required: this.options.auth.requireSession !== false,
            hasSession: !!this.session,
            sessionValid: !!this.session
          } : undefined
        };

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(contextData, null, 2)
          }]
        };
      },
      name: 'Server Context',
      description: 'Server information and context (name, version, description, endpoints, auth status, etc.)',
      mimeType: 'application/json'
    });

    if (this.logger) {
      this.logger.debug(`Default context resource registered: ${contextUri}`);
    }
  }

  /**
   * Register default config update tool
   * Allows updating server configuration dynamically via MCP
   * Uses configSchema if available for type-safe updates, otherwise falls back to generic schema
   * User can override it by registering their own tool with name "update_config"
   */
  private registerDefaultConfigTool(): void {
    const toolName = 'update_config';

    // Check if user already registered an update_config tool
    if (this.tools.has(toolName)) {
      if (this.logger) {
        this.logger.debug('Default config update tool skipped: user-defined tool already exists');
      }
      return;
    }

    // Use configSchema if available, otherwise use generic schema
    let UpdateConfigSchema: TSchema;

    if (this.options.configSchema) {
      // Use the actual config schema - Value.Cast will handle partial updates correctly
      // Wrap in Type.Object with 'config' key
      UpdateConfigSchema = Type.Object({
        config: this.options.configSchema
      });
    } else {
      // Fallback to generic schema if no configSchema provided
      UpdateConfigSchema = Type.Object({
        config: Type.Record(Type.String(), Type.Any(), {
          description: 'Partial configuration object to merge with existing config. Only provided keys will be updated.'
        })
      });
    }

    // Register default config update tool
    this.tools.set(toolName, {
      handler: async (params, context) => {
        const { config: newConfig } = params as { config: Partial<TConfig> };

        // Update config using the public method
        const updatedConfig = this.updateConfig(newConfig);

        if (this.logger) {
          this.logger.info('Configuration updated via MCP tool');
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Configuration updated successfully',
              config: updatedConfig
            }, null, 2)
          }]
        };
      },
      schema: UpdateConfigSchema,
      description: 'Update server configuration dynamically. Merges provided config with existing configuration.',
      access: undefined // Public tool, no access restrictions
    });

    if (this.logger) {
      this.logger.debug(`Default config update tool registered: ${toolName}${this.options.configSchema ? ' (with configSchema)' : ' (generic schema)'}`);
    }
  }

  /**
   * Generate resource prefix (ID) from server name or use provided ID
   */
  private generateResourcePrefix(name: string, providedId?: string): string {
    if (providedId) {
      // Validate provided ID
      if (!/^[a-z0-9-]+$/.test(providedId)) {
        throw new Error(
          `Invalid server ID "${providedId}". ` +
          `ID must be a slug: lowercase English letters, numbers, and hyphens only.`
        );
      }
      return providedId;
    }

    // Generate ID from name: lowercase, keep only English letters, numbers, hyphens, spaces -> hyphens
    const generatedId = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove non-English letters, numbers, spaces, hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // Check if generated ID contains at least one English letter
    if (!/[a-z]/.test(generatedId)) {
      throw new Error(
        `Cannot generate server ID from name "${name}". ` +
        `Name must contain at least one English letter. ` +
        `Please provide "id" option explicitly (e.g., { name: "${name}", id: "my-server-id" }).`
      );
    }

    if (!generatedId) {
      throw new Error(
        `Cannot generate server ID from name "${name}". ` +
        `Please provide "id" option explicitly (e.g., { name: "${name}", id: "my-server-id" }).`
      );
    }

    return generatedId;
  }

  /**
   * Validate name format (slug: lowercase letters, numbers, hyphens, underscores)
   */
  private validateName(name: string, type: 'tool' | 'resource' | 'prompt'): void {
    if (!name || typeof name !== 'string') {
      throw new Error(`${type} name is required and must be a string`);
    }

    // Slug format: lowercase letters, numbers, hyphens, underscores
    if (!/^[a-z0-9-_]+$/.test(name)) {
      throw new Error(
        `Invalid ${type} name "${name}". ` +
        `Name must be a slug: lowercase letters, numbers, hyphens, and underscores only.`
      );
    }
  }

  /**
   * Register a tool with object-based API
   * 
   * @example
   * ```typescript
   * import { Type } from '@sinclair/typebox';
   * 
   * const schema = Type.Object({
   *   name: Type.Optional(Type.String())
   * });
   * 
   * server.addTool({
   *   name: 'hello-world',
   *   description: 'Greet someone',
   *   schema,
   *   handler: async (params, context) => {
   *     // params is automatically typed from schema!
   *     return { content: [{ type: 'text', text: `Hello, ${params.name || 'World'}!` }] };
   *   }
   * });
   * ```
   */
  addTool<TSchemaType extends TSchema>(
    config: ToolConfig<TSchemaType, TConfig, TRoles, TSession>
  ): void {
    // Validate required fields
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Tool name is required and must be a string');
    }
    if (!config.description || typeof config.description !== 'string') {
      throw new Error('Tool description is required and must be a string');
    }
    if (!config.schema) {
      throw new Error('Tool schema is required');
    }
    if (!config.handler || typeof config.handler !== 'function') {
      throw new Error('Tool handler is required and must be a function');
    }

    // Validate name format
    this.validateName(config.name, 'tool');

    // Check uniqueness
    if (this.tools.has(config.name)) {
      throw new Error(`Tool "${config.name}" is already registered`);
    }

    // Registration
    this.tools.set(config.name, {
      handler: config.handler,
      schema: config.schema,
      description: config.description,
      access: config.access as string[] | undefined
    });

    if (this.logger) {
      this.logger.debug(`Tool registered: ${config.name}`);
    }

    this.emit('toolRegistered', config.name);
  }

  /**
   * Register a resource with object-based API
   * 
   * Resource URI will be automatically prefixed with server ID (generated from server name or provided via id option).
   * If URI already contains a scheme (e.g., "my-server://about"), it will be used as-is (with a warning if scheme doesn't match).
   * If URI doesn't contain a scheme (e.g., "about"), it will be prefixed automatically (e.g., "my-server://about").
   * 
   * @example
   * ```typescript
   * // Server with name "my-server" (or id: "my-server")
   * server.addResource({
   *   uri: 'about', // Will become: my-server://about
   *   name: 'About',
   *   description: 'Server information',
   *   handler: async (uri, context) => {
   *     // uri will be "my-server://about"
   *     return {
   *       contents: [{
   *         uri, // Use normalized URI
   *         mimeType: 'text/plain',
   *         text: 'Server info'
   *       }]
   *     };
   *   }
   * });
   * ```
   */
  addResource(config: ResourceConfig<TConfig, TRoles, TSession>): void {
    // Validate required fields
    if (!config.uri || typeof config.uri !== 'string') {
      throw new Error('Resource URI is required and must be a string');
    }
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Resource name is required and must be a string');
    }
    if (!config.description || typeof config.description !== 'string') {
      throw new Error('Resource description is required and must be a string');
    }
    if (!config.handler || typeof config.handler !== 'function') {
      throw new Error('Resource handler is required and must be a function');
    }

    // Normalize URI: add prefix if not already present
    let normalizedUri = config.uri;

    // Check if URI already has a scheme (contains ://)
    if (!normalizedUri.includes('://')) {
      // No scheme, add server prefix
      normalizedUri = `${this.resourcePrefix}://${normalizedUri}`;
    } else {
      // Has scheme, check if it matches our prefix
      const [scheme, ...rest] = normalizedUri.split('://');
      if (scheme !== this.resourcePrefix) {
        // Different scheme - warn but allow (for flexibility)
        if (this.logger) {
          this.logger.warn(
            `Resource URI "${config.uri}" uses scheme "${scheme}" instead of server prefix "${this.resourcePrefix}". ` +
            `Consider using "${this.resourcePrefix}://${rest.join('://')}" for consistency.`
          );
        }
      }
    }

    // Check uniqueness
    if (this.resources.has(normalizedUri)) {
      throw new Error(`Resource "${normalizedUri}" is already registered`);
    }

    // Registration (use normalized URI)
    this.resources.set(normalizedUri, {
      handler: config.handler,
      name: config.name,
      description: config.description,
      mimeType: config.mimeType || 'text/plain',
      access: config.access as string[] | undefined
    });

    if (this.logger) {
      this.logger.debug(`Resource registered: ${normalizedUri}${normalizedUri !== config.uri ? ` (normalized from ${config.uri})` : ''}`);
    }

    this.emit('resourceRegistered', normalizedUri);
  }

  /**
   * Register a prompt with object-based API
   * 
   * @example
   * ```typescript
   * import { Type } from '@sinclair/typebox';
   * 
   * const argsSchema = Type.Object({
   *   topic: Type.String({ description: 'Topic to explain' })
   * });
   * 
   * server.addPrompt({
   *   name: 'explain-topic',
   *   description: 'Explain a topic',
   *   arguments: argsSchema,
   *   handler: async (params, context) => {
   *     // params is automatically typed from arguments schema!
   *     return {
   *       messages: [{
   *         role: 'user',
   *         content: { type: 'text', text: `Explain ${params.topic}` }
   *       }]
   *     };
   *   }
   * });
   * ```
   */
  addPrompt<TSchemaType extends TSchema>(
    config: PromptConfig<TSchemaType, TConfig, TRoles, TSession>
  ): void {
    // Validate required fields
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Prompt name is required and must be a string');
    }
    if (!config.description || typeof config.description !== 'string') {
      throw new Error('Prompt description is required and must be a string');
    }
    if (!config.handler || typeof config.handler !== 'function') {
      throw new Error('Prompt handler is required and must be a function');
    }

    // Validate name format
    this.validateName(config.name, 'prompt');

    // Check uniqueness
    if (this.prompts.has(config.name)) {
      throw new Error(`Prompt "${config.name}" is already registered`);
    }

    // Registration
    this.prompts.set(config.name, {
      handler: config.handler,
      description: config.description,
      arguments: config.arguments,
      access: config.access as string[] | undefined
    });

    if (this.logger) {
      this.logger.debug(`Prompt registered: ${config.name}`);
    }

    this.emit('promptRegistered', config.name);
  }

  /**
   * Get current configuration (read-only)
   */
  getConfig(): TConfig {
    return this.config;
  }

  /**
   * Get secrets storage (read-only Map)
   * Secrets are extracted from ENV variables with SECRET_ prefix
   */
  getSecrets(): ReadonlyMap<string, string> {
    return this.secrets;
  }

  /**
   * Get project root (workspace)
   */
  getProjectRoot(): string | undefined {
    return this.projectRoot;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Check for --meta flag BEFORE starting server
    // This allows Extension to get metadata without starting HTTP server
    if (process.argv.includes('--meta') || process.argv.includes('--metadata')) {
      if (!this.isInitialized) {
        await this.initialize();
      }
      const metadata = this.getMetadata();
      // Output only JSON, no logs
      console.log(JSON.stringify(metadata, null, 2));
      process.exit(0);
    }

    if (!this.isInitialized) {
      throw new Error('Server must be initialized before starting. Call initialize() first.');
    }
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    try {

      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(this.port, this.host, () => {
          resolve();
        });
        this.httpServer.on('error', reject);
      });

      this.isRunning = true;

      // Setup graceful shutdown handlers (only once)
      if (!this.signalHandlersInstalled) {
        this.setupGracefulShutdown();
        this.signalHandlersInstalled = true;
      }

      if (this.logger) {
        this.logger.info(`Server started on ${this.host}:${this.port}`);
        this.logger.info(`MCP endpoint: http://${this.host}:${this.port}${this.mcpPath}`);
        this.logger.info(`Health: http://${this.host}:${this.port}/health`);
      }

      this.emit('started', this.port, this.host);
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to start server:', error);
      }
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers for SIGINT and SIGTERM
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.logger) {
        this.logger.info(`Received ${signal}, shutting down gracefully...`);
      }

      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        if (this.logger) {
          this.logger.error('Error during shutdown:', error);
        }
        process.exit(1);
      }
    };

    // Create handlers and store references for potential removal
    this.sigintHandler = () => shutdown('SIGINT');
    this.sigtermHandler = () => shutdown('SIGTERM');

    process.on('SIGINT', this.sigintHandler);
    process.on('SIGTERM', this.sigtermHandler);

    if (this.logger) {
      this.logger.debug('Graceful shutdown handlers installed');
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Close MCP server
      await this.mcpServer.close();

      // Clear rate limiter cleanup interval
      if (this.rateLimiterCleanupInterval) {
        clearInterval(this.rateLimiterCleanupInterval);
        this.rateLimiterCleanupInterval = undefined;
      }

      this.isRunning = false;

      if (this.logger) {
        this.logger.info('Server stopped');
      }

      this.emit('stopped');
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to stop server:', error);
      }
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get server port
   */
  get serverPort(): number {
    return this.port;
  }

  /**
   * Get server host
   */
  get serverHost(): string {
    return this.host;
  }

  /**
   * Check if server is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Convert TypeBox schema to JSON Schema
   * 
   * TypeBox schemas are already JSON Schema compatible.
   * We just serialize/deserialize to remove any internal symbols.
   */
  private typeboxToJsonSchema(schema: TSchema): Record<string, unknown> {
    // TypeBox schemas are already JSON Schema compatible
    // JSON.stringify automatically removes non-serializable symbols
    return JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  }

  /**
   * Format validation errors into a readable string
   */
  private formatValidationErrors(errors: any[]): string {
    return errors.map(err =>
      `${err.path || 'root'}: ${err.message || 'Invalid value'}`
    ).join('; ');
  }

  /**
   * Get server ID (resource prefix)
   */
  get serverId(): string {
    return this.resourcePrefix;
  }

  /**
   * Get current session (if authentication is enabled)
   */
  getSession(): TSession | undefined {
    return this.session;
  }

  /**
   * Get list of registered tool names
   */
  getTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get list of registered resource URIs
   */
  getResources(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * Get list of registered prompt names
   */
  getPrompts(): string[] {
    return Array.from(this.prompts.keys());
  }

  /**
   * Get server metadata without starting the server
   * 
   * This method can be called after initialize() to get complete server information
   * including tools, resources, prompts, configuration, and authentication status.
   * Useful for validation, documentation generation, or CLI tools that need to
   * inspect server capabilities before starting.
   * 
   * @returns Server metadata object
   * 
   * @example
   * ```typescript
   * const server = new McpServer({ ... });
   * // ... register tools/resources/prompts ...
   * await server.initialize();
   * 
   * const metadata = server.getMetadata();
   * console.log(JSON.stringify(metadata, null, 2));
   * // Output metadata without starting the server
   * ```
   * 
   * @example
   * ```typescript
   * // CLI usage with --meta flag
   * if (process.argv.includes('--meta')) {
   *   await server.initialize();
   *   const metadata = server.getMetadata();
   *   console.log(JSON.stringify(metadata, null, 2));
   *   process.exit(0);
   * }
   * ```
   */
  getMetadata(): ServerMetadata {
    const metadata: ServerMetadata = {
      server: {
        name: this.options.name,
        version: this.options.version,
        description: this.options.description,
        id: this.resourcePrefix,
        protocolVersion: this.protocolVersion
      },
      tools: Array.from(this.tools.entries()).map(([name, def]) => ({
        name,
        description: def.description,
        inputSchema: this.typeboxToJsonSchema(def.schema),
        access: def.access
      })),
      resources: Array.from(this.resources.entries()).map(([uri, def]) => ({
        uri,
        name: def.name,
        description: def.description,
        mimeType: def.mimeType,
        access: def.access
      })),
      prompts: Array.from(this.prompts.entries()).map(([name, def]) => ({
        name,
        description: def.description,
        arguments: def.arguments
          ? this.typeboxToJsonSchema(def.arguments)
          : undefined,
        access: def.access
      })),
      config: {
        schema: this.options.configSchema
          ? this.typeboxToJsonSchema(this.options.configSchema)
          : undefined,
        loaded: this.isInitialized,
        hasConfig: Object.keys(this.config).length > 0
      },
      auth: this.options.auth ? {
        required: this.options.auth.requireSession !== false,
        hasSession: !!this.session,
        roles: Object.keys(this.options.auth.roles) as string[]
      } : undefined,
      projectRoot: this.projectRoot
    };

    return metadata;
  }
}
