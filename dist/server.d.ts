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
import { EventEmitter } from 'events';
import { type TSchema } from '@sinclair/typebox';
import type { McpServerOptions, ToolConfig, ResourceConfig, PromptConfig } from './types.js';
import type { ServerMetadata } from './extension.js';
/**
 * Main MCP Server class
 */
export declare class McpServer<TConfig extends Record<string, unknown> = Record<string, unknown>, TRoles extends string = never, TSession extends Record<string, unknown> = Record<string, unknown>> extends EventEmitter {
    private options;
    private mcpServer;
    private httpServer;
    private transportManager;
    private config;
    private secrets;
    private projectRoot?;
    private session?;
    private tools;
    private resources;
    private prompts;
    private port;
    private host;
    private mcpPath;
    private corsOptions?;
    private httpOptions;
    private securityOptions;
    private handlerOptions;
    private rateLimiter?;
    private logger?;
    private errorHandler?;
    private signalHandlersInstalled;
    private sigintHandler?;
    private sigtermHandler?;
    private resourcePrefix;
    private startTime;
    private isRunning;
    private isInitialized;
    private protocolVersion;
    private rateLimiterCleanupInterval?;
    constructor(options: McpServerOptions<TConfig, TRoles, TSession>);
    /**
     * Initialize server: load config, load session, filter by access, setup endpoints, register handlers
     */
    initialize(): Promise<void>;
    /**
     * Load session from MCP_AUTH_TOKEN environment variable
     *
     * MCP_AUTH_TOKEN always contains a token/key (string), which is processed
     * by auth.loadSession() to get the full session object.
     */
    private loadSession;
    /**
     * Filter tools/resources/prompts by access control
     * Called AFTER loadConfiguration() so guards have access to config
     */
    private filterByAccess;
    /**
     * Extract secrets from environment variables
     * Secrets are variables with SECRET_ prefix
     * They are extracted and removed from process.env to prevent them from being included in config
     */
    private extractSecretsFromEnv;
    /**
     * Load and merge configuration
     */
    private loadConfiguration;
    /**
     * Apply HTTP server options
     */
    private applyHttpOptions;
    /**
     * Setup Extension endpoints (health, project-root, config)
     */
    private setupExtensionEndpoints;
    /**
     * Hello endpoint - provides server information, MCP protocol details, and health status
     */
    private hello;
    /**
     * Handle update project root endpoint
     */
    private handleUpdateProjectRoot;
    /**
     * Handle get config endpoint
     */
    private handleGetConfig;
    /**
     * Handle update config endpoint
     */
    private handleUpdateConfig;
    /**
     * Update configuration dynamically
     * Can be called at any time to update server configuration
     *
     * @param newConfig - Partial configuration to merge with existing config
     * @returns Updated configuration
     */
    updateConfig(newConfig: Partial<TConfig>): TConfig;
    /**
     * Wrap handler with timeout
     */
    private withTimeout;
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
    private createContext;
    /**
     * Handle error through error handler middleware
     * Transforms errors into human-readable messages for Cursor
     */
    private handleError;
    /**
     * Register MCP protocol handlers
     */
    private registerMcpHandlers;
    /**
     * Register default context resource with server information
     * This resource provides server metadata similar to /health endpoint
     * User can override it by registering their own resource with URI "context"
     */
    private registerDefaultContextResource;
    /**
     * Register default config update tool
     * Allows updating server configuration dynamically via MCP
     * Uses configSchema if available for type-safe updates, otherwise falls back to generic schema
     * User can override it by registering their own tool with name "update_config"
     */
    private registerDefaultConfigTool;
    /**
     * Generate resource prefix (ID) from server name or use provided ID
     */
    private generateResourcePrefix;
    /**
     * Validate name format (slug: lowercase letters, numbers, hyphens, underscores)
     */
    private validateName;
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
    addTool<TSchemaType extends TSchema>(config: ToolConfig<TSchemaType, TConfig, TRoles, TSession>): void;
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
    addResource(config: ResourceConfig<TConfig, TRoles, TSession>): void;
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
    addPrompt<TSchemaType extends TSchema>(config: PromptConfig<TSchemaType, TConfig, TRoles, TSession>): void;
    /**
     * Get current configuration (read-only)
     */
    getConfig(): TConfig;
    /**
     * Get secrets storage (read-only Map)
     * Secrets are extracted from ENV variables with SECRET_ prefix
     */
    getSecrets(): ReadonlyMap<string, string>;
    /**
     * Get project root (workspace)
     */
    getProjectRoot(): string | undefined;
    /**
     * Start the server
     */
    start(): Promise<void>;
    /**
     * Setup graceful shutdown handlers for SIGINT and SIGTERM
     */
    private setupGracefulShutdown;
    /**
     * Stop the server
     */
    stop(): Promise<void>;
    /**
     * Get server port
     */
    get serverPort(): number;
    /**
     * Get server host
     */
    get serverHost(): string;
    /**
     * Check if server is running
     */
    get running(): boolean;
    /**
     * Convert TypeBox schema to JSON Schema
     *
     * TypeBox schemas are already JSON Schema compatible.
     * We just serialize/deserialize to remove any internal symbols.
     */
    private typeboxToJsonSchema;
    /**
     * Format validation errors into a readable string
     */
    private formatValidationErrors;
    /**
     * Get server ID (resource prefix)
     */
    get serverId(): string;
    /**
     * Get current session (if authentication is enabled)
     */
    getSession(): TSession | undefined;
    /**
     * Get list of registered tool names
     */
    getTools(): string[];
    /**
     * Get list of registered resource URIs
     */
    getResources(): string[];
    /**
     * Get list of registered prompt names
     */
    getPrompts(): string[];
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
    getMetadata(): ServerMetadata;
}
//# sourceMappingURL=server.d.ts.map