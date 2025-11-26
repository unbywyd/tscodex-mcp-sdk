/**
 * TypeScript types and interfaces for MCP SDK
 */

import type { TSchema, Static } from '@sinclair/typebox';
import type { CorsOptions } from './transport.js';
import type { RateLimitConfig } from './security.js';

/**
 * TypeBox Schema type - we use TypeBox for typing and validation
 * TypeBox generates both TypeScript types and JSON Schema from a single source
 */
export type Schema = TSchema;

/**
 * Forward declaration for McpServer (defined in server.ts)
 */
export interface McpServer<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TRoles extends string = never,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  getConfig(): TConfig;
  getProjectRoot(): string | undefined;
}

/**
 * Guard function with access to full context (config, projectRoot, server)
 * 
 * @param session - Current user session
 * @param context - Context with loaded configuration, project root, and server instance
 * @returns true if user has access, false otherwise (supports async)
 */
export type RoleGuard<
  TRoles extends string,
  TSession extends Record<string, unknown>,
  TConfig extends Record<string, unknown>
> = (
  session: TSession,
  context: {
    config: TConfig;
    projectRoot?: string;
    server: McpServer<TConfig, TRoles, TSession>;
  }
) => boolean | Promise<boolean>;

/**
 * Authentication configuration
 */
export interface AuthConfig<
  TRoles extends string,
  TSession extends Record<string, unknown>,
  TConfig extends Record<string, unknown>
> {
  /** Role guards - functions that check if user has access to a role */
  roles: Record<TRoles, RoleGuard<TRoles, TSession, TConfig>>;
  /** TypeBox schema for session validation */
  sessionSchema: TSchema;
  /** Require session to be present (default: true) */
  requireSession?: boolean;
  /** 
   * REQUIRED async function to load/process session from token/key
   * 
   * MCP_AUTH_TOKEN environment variable always contains a token/key (string),
   * not a full session object. This function is responsible for:
   * - Validating the token/key
   * - Fetching user data from external API/database
   * - Transforming token into full session object
   * 
   * This is called BEFORE sessionSchema validation.
   * 
   * @param token - Token/key from MCP_AUTH_TOKEN environment variable (always a string)
   * @param context - Context with loaded configuration
   * @returns Processed session data that will be validated against sessionSchema
   * 
   * @example
   * ```typescript
   * loadSession: async (token, context) => {
   *   // Validate token and fetch user session from API
   *   const response = await fetch(`${context.config.apiUrl}/validate-token`, {
   *     method: 'POST',
   *     headers: { 'Authorization': `Bearer ${token}` }
   *   });
   *   
   *   if (!response.ok) {
   *     throw new Error('Invalid token');
   *   }
   *   
   *   const userData = await response.json();
   *   return {
   *     userId: userData.id,
   *     email: userData.email,
   *     role: userData.role
   *   } as Session;
   * }
   * ```
   */
  loadSession: (
    token: string,
    context: {
      config: TConfig;
      projectRoot?: string;
    }
  ) => Promise<TSession>;
}

/**
 * Options for creating an MCP server
 */
export interface McpServerOptions<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TRoles extends string = never,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  // Server metadata (REQUIRED)
  name: string;                    // REQUIRED: unique MCP server name
  version: string;                 // REQUIRED: server version (semver)
  description: string;             // REQUIRED: server purpose description (what it's for)
  
  // Resource prefix (OPTIONAL)
  id?: string;                     // OPTIONAL: server ID/slug for resource URI prefix (e.g., "my-server")
                                   // If not provided, will be generated from name (lowercase, English letters only)
                                   // If name doesn't contain English letters and id is not provided, will throw error

  // Configuration (OPTIONAL)
  configSchema?: TSchema;         // OPTIONAL: TypeBox schema for Extension UI and validation
  configFile?: string;            // OPTIONAL: Default config file path (e.g., '.cursor-stock-images.json')
  loadConfig?: (parsedConfig: Partial<TConfig>) => Promise<TConfig>; // OPTIONAL: function to process parsed config (CLI + ENV + file)
  
  // Notes:
  // - Extension passes configuration via process.env.MCP_CONFIG (JSON string)
  // - Extension passes port via process.env.MCP_PORT (read automatically by SDK)
  // - Extension passes host via process.env.MCP_HOST (read automatically by SDK, default '0.0.0.0')
  // - Extension passes project root via process.env.MCP_PROJECT_ROOT (read automatically by SDK)
  // - Extension passes auth token via process.env.MCP_AUTH_TOKEN (string token/key, for auth-enabled servers)
  // - SDK automatically parses CLI args, ENV vars, and config file (if configFile is set)
  // - Parsed config is passed to loadConfig() which can process/transform it
  // - Extension config (MCP_CONFIG) takes priority over loadConfig result
  // - IMPORTANT: Extension configuration is updated ONLY by restarting the process with new ENV variables
  // - SDK does NOT provide updateConfig() method - configuration is read-only via getConfig()
  // - If a plugin wants to allow users to update settings during runtime,
  //   it can manage this independently through its own MCP tools and internal state

  // Authentication & Authorization (OPTIONAL)
  auth?: AuthConfig<TRoles, TSession, TConfig>;

  // Server settings (OPTIONAL)
  // IMPORTANT: port, host, and mcpPath are passed by Extension via environment variables!
  // These parameters are used only for standalone mode (without Extension)
  mcpPath?: string;                 // Path for MCP endpoint (Extension passes via MCP_PATH env var, default '/mcp')
  corsOptions?: CorsOptions;        // CORS configuration (default: permissive - allow all '*')

  // HTTP Server options (OPTIONAL)
  httpOptions?: ServerHttpOptions;   // HTTP server configuration (timeouts, keep-alive, etc.)

  // Security options (OPTIONAL)
  securityOptions?: ServerSecurityOptions; // Security configuration (rate limiting, max body size, etc.)

  // Handler options (OPTIONAL)
  handlerOptions?: ServerHandlerOptions; // Handler timeout configuration

  // Error handling (OPTIONAL)
  errorHandler?: ErrorHandler<TConfig, TSession>; // Custom error handler middleware

  // Logging (OPTIONAL)
  logger?: Logger;                  // Custom logger
}

/**
 * HTTP Server configuration options
 */
export interface ServerHttpOptions {
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeout?: number;
  /** Keep-alive timeout in milliseconds (default: 5000) */
  keepAliveTimeout?: number;
  /** Maximum number of headers (default: 2000) */
  maxHeadersCount?: number;
  /** Maximum header size in bytes (default: 16384) */
  maxHeaderSize?: number;
  /** Enable keep-alive (default: true) */
  keepAlive?: boolean;
}

/**
 * Security configuration options
 */
export interface ServerSecurityOptions {
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  /** Maximum request body size in bytes (default: 10MB) */
  maxRequestBodySize?: number;
  /** Enable request size validation (default: true) */
  validateRequestSize?: boolean;
}

/**
 * Handler timeout configuration
 */
export interface ServerHandlerOptions {
  /** Default timeout for tool handlers in milliseconds (default: 30000) */
  toolHandlerTimeout?: number;
  /** Default timeout for resource handlers in milliseconds (default: 30000) */
  resourceHandlerTimeout?: number;
  /** Default timeout for prompt handlers in milliseconds (default: 30000) */
  promptHandlerTimeout?: number;
}

/**
 * Tool handler function with automatic type inference from TypeBox schema
 * 
 * @param params - Tool parameters (automatically typed from TypeBox schema)
 * @param context - Server context with access to configuration, project root, session and other data
 */
export type ToolHandler<
  TSchemaType extends TSchema,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> = (
  params: Static<TSchemaType>,
  context: ToolContext<TConfig, TSession>
) => Promise<ToolResult>;

/**
 * Tool configuration for object-based API
 */
export interface ToolConfig<
  TSchemaType extends TSchema,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TRoles extends string = never,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  /** Tool name (slug format: lowercase letters, numbers, hyphens, underscores) */
  name: string;
  /** Tool description (required) */
  description: string;
  /** TypeBox schema for tool parameters (required) */
  schema: TSchemaType;
  /** Tool handler function (params automatically typed from schema) */
  handler: ToolHandler<TSchemaType, TConfig, TSession>;
  /** Access control: list of roles that can use this tool (optional - if not specified, tool is public) */
  access?: TRoles[];
}

/**
 * Tool context passed to handlers
 * 
 * Provides access to server data without needing to store a reference to the server in closures
 * 
 * Note: `config` contains full configuration including secrets. Handlers should use
 * `filterMcpPublicConfig()` utility if they need to return config values in results
 * to ensure only public MCP parameters (mcp_* keys) are exposed.
 */
export interface ToolContext<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  /** 
   * Public server configuration (settings, no secrets).
   * All configuration is public and safe to expose.
   */
  config: TConfig;
  
  /** 
   * Secrets storage - access secrets via get() method.
   * Secrets are extracted from ENV variables with SECRET_ prefix.
   * 
   * @example
   * const apiKey = context.secrets.get('SECRET_PEXELS_API_KEY');
   */
  secrets: Map<string, string>;
  
  /** Project root (workspace) from Extension */
  projectRoot?: string;
  
  /** Server instance for accessing other methods (if needed) */
  server: McpServer<TConfig, any, TSession>;
  
  /** Current user session (if authentication is enabled, may be undefined for public tools) */
  session?: TSession;
}

/**
 * Tool result
 */
export interface ToolResult {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

/**
 * Resource handler function
 * 
 * @param uri - Resource URI
 * @param context - Server context with access to configuration, project root, session and other data
 */
export type ResourceHandler<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> = (
  uri: string,
  context: ResourceContext<TConfig, TSession>
) => Promise<ResourceResult>;

/**
 * Resource configuration for object-based API
 */
export interface ResourceConfig<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TRoles extends string = never,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  /** Resource URI */
  uri: string;
  /** Resource name (required) */
  name: string;
  /** Resource description (required) */
  description: string;
  /** Resource handler function */
  handler: ResourceHandler<TConfig, TSession>;
  /** MIME type (optional, default: 'text/plain') */
  mimeType?: string;
  /** Access control: list of roles that can access this resource (optional - if not specified, resource is public) */
  access?: TRoles[];
}

/**
 * Resource context passed to handlers
 * 
 * Provides access to server data without needing to store a reference to the server in closures
 */
export interface ResourceContext<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  /** 
   * Public server configuration (settings, no secrets).
   * All configuration is public and safe to expose.
   */
  config: TConfig;
  
  /** 
   * Secrets storage - access secrets via get() method.
   * Secrets are extracted from ENV variables with SECRET_ prefix.
   * 
   * @example
   * const apiKey = context.secrets.get('SECRET_PEXELS_API_KEY');
   */
  secrets: Map<string, string>;
  
  /** Project root (workspace) from Extension */
  projectRoot?: string;
  
  /** Server instance for accessing other methods (if needed) */
  server: McpServer<TConfig, any, TSession>;
  
  /** Current user session (if authentication is enabled, may be undefined for public resources) */
  session?: TSession;
}

/**
 * Resource result
 */
export interface ResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text?: string;
    blob?: string;
  }>;
}

/**
 * Prompt handler function with automatic type inference from TypeBox schema
 * 
 * @param params - Prompt parameters (automatically typed from TypeBox schema)
 * @param context - Server context with access to configuration, project root, session and other data
 */
export type PromptHandler<
  TSchemaType extends TSchema,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> = (
  params: Static<TSchemaType>,
  context: PromptContext<TConfig, TSession>
) => Promise<PromptResult>;

/**
 * Prompt configuration for object-based API
 */
export interface PromptConfig<
  TSchemaType extends TSchema,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TRoles extends string = never,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  /** Prompt name (slug format: lowercase letters, numbers, hyphens, underscores) */
  name: string;
  /** Prompt description (required) */
  description: string;
  /** TypeBox schema for prompt arguments (optional) */
  arguments?: TSchemaType;
  /** Prompt handler function (params automatically typed from arguments schema) */
  handler: PromptHandler<TSchemaType, TConfig, TSession>;
  /** Access control: list of roles that can use this prompt (optional - if not specified, prompt is public) */
  access?: TRoles[];
}

/**
 * Prompt context passed to handlers
 * 
 * Provides access to server data without needing to store a reference to the server in closures
 */
export interface PromptContext<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  /** 
   * Public server configuration (settings, no secrets).
   * All configuration is public and safe to expose.
   */
  config: TConfig;
  
  /** 
   * Secrets storage - access secrets via get() method.
   * Secrets are extracted from ENV variables with SECRET_ prefix.
   * 
   * @example
   * const apiKey = context.secrets.get('SECRET_PEXELS_API_KEY');
   */
  secrets: Map<string, string>;
  
  /** Project root (workspace) from Extension */
  projectRoot?: string;
  
  /** Server instance for accessing other methods (if needed) */
  server: McpServer<TConfig, any, TSession>;
  
  /** Current user session (if authentication is enabled, may be undefined for public prompts) */
  session?: TSession;
}

/**
 * Prompt result
 */
export interface PromptResult {
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}

/**
 * Logger interface
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

/**
 * Error handler context - information about where the error occurred
 */
export interface ErrorHandlerContext<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> {
  /** Type of handler where error occurred */
  type: 'tool' | 'resource' | 'prompt';
  /** Name/URI of the handler */
  name: string;
  /** Parameters passed to the handler */
  params?: unknown;
  /** Handler context */
  context: ToolContext<TConfig, TSession> | ResourceContext<TConfig, TSession> | PromptContext<TConfig, TSession>;
}

/**
 * Error handler function - transforms errors into human-readable messages for Cursor
 * 
 * @param error - Original error that occurred
 * @param errorContext - Context about where the error occurred
 * @returns Human-readable error message or Error object
 * 
 * @example
 * ```typescript
 * errorHandler: (error, context) => {
 *   if (error instanceof FileNotFoundError) {
 *     return `File not found: ${error.path}. Please check the file path.`;
 *   }
 *   if (error instanceof PermissionError) {
 *     return `Access denied to resource. Please contact administrator.`;
 *   }
 *   // Fallback to default message
 *   return `An error occurred while executing ${context.type} "${context.name}": ${error.message}`;
 * }
 * ```
 */
export type ErrorHandler<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TSession extends Record<string, unknown> = Record<string, unknown>
> = (
  error: unknown,
  errorContext: ErrorHandlerContext<TConfig, TSession>
) => string | Error;

