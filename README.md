# @tscodex/mcp-sdk

> **TypeScript SDK for creating MCP (Model Context Protocol) servers with seamless Extension integration**

[![npm version](https://img.shields.io/npm/v/@tscodex/mcp-sdk)](https://www.npmjs.com/package/@tscodex/mcp-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Overview

`@tscodex/mcp-sdk` is a production-ready TypeScript SDK for building MCP servers with built-in support for:

- ✅ **Type-safe APIs** using TypeBox schemas
- ✅ **Configuration management** with Extension integration
- ✅ **Authentication & Authorization** with role-based access control
- ✅ **HTTP transport** for MCP protocol
- ✅ **Security features** (rate limiting, request validation, path sanitization)
- ✅ **Error handling** middleware
- ✅ **Graceful shutdown** handling
- ✅ **Extension endpoints** (health checks, configuration)

---

## 📦 Installation

```bash
npm install @tscodex/mcp-sdk
```

**Requirements:**
- Node.js >= 18.0.0
- TypeScript >= 5.0.0

---

## 🚀 Quick Start

### Server Name Validation

Server name must:
- Start with a Latin letter (a-z, A-Z)
- Contain only Latin letters, numbers, hyphens (-), and underscores (_)
- Not start with a number

**Valid examples:** `my-server`, `mcp_images`, `server123`, `MyServer`  
**Invalid examples:** `@tscodex/mcp-images` (contains @ and /), `123server` (starts with number), `my server` (contains space)

### Minimal Server

```typescript
import { McpServer, Type } from '@tscodex/mcp-sdk';

const server = new McpServer({
  name: 'hello-server',
  version: '1.0.0',
  description: 'Simple hello world MCP server'
});

// Define schema using TypeBox
const HelloSchema = Type.Object({
  name: Type.Optional(Type.String({ 
    description: 'Name to greet',
    default: 'World'
  }))
});

// Register tool with automatic type inference
server.addTool({
  name: 'hello-world',
  description: 'Greet someone with a personalized message',
  schema: HelloSchema,
  handler: async (params, context) => {
    // params is automatically typed as { name?: string }
    const name = params.name || 'World';
    return {
      content: [{
        type: 'text',
        text: `Hello, ${name}!`
      }]
    };
  }
});

// Initialize and start
await server.initialize();
await server.start();
console.log(`Server running on port ${server.serverPort}`);
```

---

## 📚 Core Features

### 1. Type-Safe Configuration

```typescript
import { McpServer, Type, Static } from '@tscodex/mcp-sdk';

const ConfigSchema = Type.Object({
  apiKey: Type.String({ minLength: 10 }),
  timeout: Type.Number({ default: 5000 }),
  enabled: Type.Boolean({ default: true })
});

type Config = Static<typeof ConfigSchema>;

const server = new McpServer<Config>({
  name: 'api-server',
  version: '1.0.0',
  description: 'API integration server',
  configSchema: ConfigSchema,
  loadConfig: async () => {
    // Extension config is passed via process.env.MCP_CONFIG
    const extensionConfig = process.env.MCP_CONFIG 
      ? JSON.parse(process.env.MCP_CONFIG) 
      : {};
    
    return {
      timeout: 5000,
      enabled: true,
      ...extensionConfig // Extension config takes priority
    };
  }
});

// Access configuration in handlers
server.addTool({
  name: 'api-call',
  schema: Type.Object({}),
  handler: async (params, context) => {
    // context.config contains full config including secrets
    const timeout = context.config.timeout;
    const apiKey = context.config.apiKey; // Full access to all config
    
    // If you need to return config in result, filter public parameters
    import { filterMcpPublicConfig } from '@tscodex/mcp-sdk';
    const publicConfig = filterMcpPublicConfig(context.config);
    // Only 'mcp_*' keys will be in publicConfig
    
    // ...
  }
});
```

### 2. Authentication & Authorization

```typescript
import { McpServer, Type, Static } from '@tscodex/mcp-sdk';

enum Roles {
  ADMIN = 'admin',
  USER = 'user'
}

const SessionSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  role: Type.Enum(Roles)
});

type Session = Static<typeof SessionSchema>;

const server = new McpServer<Config, Roles, Session>({
  name: 'secure-server',
  version: '1.0.0',
  description: 'Server with role-based access',
  auth: {
    roles: {
      admin: (session, context) => {
        // Access to loaded configuration
        const allowedAdmins = context.config.adminEmails || [];
        return session.role === Roles.ADMIN && 
               allowedAdmins.includes(session.email);
      },
      user: async (session, context) => {
        // Async checks supported
        return session.role === Roles.USER;
      }
    },
    sessionSchema: SessionSchema,
    requireSession: true,
    // Transform token from MCP_AUTH_TOKEN into full session
    loadSession: async (token, context) => {
      // Validate token and fetch user data
      const response = await fetch(`${context.config.apiUrl}/validate-token`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await response.json() as Session;
    }
  }
});

// Tools with access control
server.addTool({
  name: 'delete-file',
  description: 'Delete a file (admin only)',
  schema: Type.Object({ path: Type.String() }),
  access: [Roles.ADMIN], // Only admins can use this tool
  handler: async (params, context) => {
    // context.session is typed as Session
    console.log(`Admin ${context.session.email} deleted ${params.path}`);
    // ...
  }
});
```

### 3. Resources & Prompts

```typescript
// Register resource (URI automatically prefixed with server ID)
server.addResource({
  uri: 'about', // Becomes: hello-server://about
  name: 'About',
  description: 'Server information',
  handler: async (uri, context) => {
    return {
      contents: [{
        uri, // Use normalized URI
        mimeType: 'text/plain',
        text: 'Server information...'
      }]
    };
  }
});

// Register prompt
server.addPrompt({
  name: 'explain-topic',
  description: 'Explain a topic',
  arguments: Type.Object({
    topic: Type.String({ description: 'Topic to explain' })
  }),
  handler: async (params, context) => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Explain ${params.topic}`
        }
      }]
    };
  }
});
```

### 4. Error Handling

```typescript
import type { ErrorHandler } from '@tscodex/mcp-sdk';

const errorHandler: ErrorHandler = (error, context) => {
  if (error instanceof FileNotFoundError) {
    return `File not found: ${error.path}. Please check the file path.`;
  }
  if (error instanceof PermissionError) {
    return `Access denied. Please contact administrator.`;
  }
  // Fallback to default message
  return `An error occurred while executing ${context.type} "${context.name}": ${error.message}`;
};

const server = new McpServer({
  name: 'my-server',
  version: '1.0.0',
  description: 'Server with custom error handling',
  errorHandler
});
```

### 5. Security Features

```typescript
import { RateLimiter } from '@tscodex/mcp-sdk';

const server = new McpServer({
  name: 'secure-server',
  version: '1.0.0',
  description: 'Server with security features',
  securityOptions: {
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      message: 'Too many requests'
    },
    maxRequestBodySize: 10 * 1024 * 1024, // 10MB
    validateRequestSize: true
  },
  httpOptions: {
    requestTimeout: 30000,
    keepAliveTimeout: 5000
  }
});
```

### 6. Logging

```typescript
const server = new McpServer({
  name: 'my-server',
  version: '1.0.0',
  description: 'Server with custom logger',
  logger: {
    info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
    debug: (msg, ...args) => console.debug(`[DEBUG] ${msg}`, ...args)
  }
});
```

---

## 📖 API Reference

### `McpServer<TConfig, TRoles, TSession>`

Main server class.

#### Constructor

```typescript
interface McpServerOptions<TConfig, TRoles, TSession> {
  // REQUIRED
  name: string;                    // Unique server name (must start with Latin letter, 
                                   // contain only letters, numbers, hyphens, underscores)
  version: string;                 // Version (semver)
  description: string;             // Server description
  
  // OPTIONAL
  id?: string;                     // Server ID for resource prefix (auto-generated from name)
  configSchema?: TSchema;          // TypeBox schema for configuration
  loadConfig?: () => Promise<TConfig>; // Load local configuration
  auth?: AuthConfig<TRoles, TSession, TConfig>; // Authentication config
  mcpPath?: string;                // MCP endpoint path (default: '/mcp')
  corsOptions?: CorsOptions;       // CORS configuration
  httpOptions?: ServerHttpOptions;  // HTTP server options
  securityOptions?: ServerSecurityOptions; // Security options
  handlerOptions?: ServerHandlerOptions; // Handler timeout options
  errorHandler?: ErrorHandler<TConfig, TSession>; // Error handler
  logger?: Logger;                 // Custom logger
}
```

#### Methods

```typescript
// Initialization
await server.initialize(): Promise<void>;
await server.start(): Promise<void>;
await server.stop(): Promise<void>;

// Tool registration
server.addTool<TSchemaType>(config: ToolConfig<TSchemaType, TConfig, TRoles, TSession>): void;

// Resource registration
server.addResource(config: ResourceConfig<TConfig, TRoles, TSession>): void;

// Prompt registration
server.addPrompt<TSchemaType>(config: PromptConfig<TSchemaType, TConfig, TRoles, TSession>): void;

// Access methods
server.getConfig(): TConfig;
server.getProjectRoot(): string | undefined;
server.getSession(): TSession | undefined;
server.getTools(): string[];
server.getResources(): string[];
server.getPrompts(): string[];
server.getMetadata(): ServerMetadata;  // Get server metadata (tools, resources, prompts, config schema)

// Properties
server.serverId: string;           // Server ID (resource prefix)
server.serverPort: number;         // Server port
server.serverHost: string;         // Server host
server.running: boolean;             // Is server running
```

#### Events

```typescript
server.on('initialized', () => {});
server.on('started', (port: number, host: string) => {});
server.on('stopped', () => {});
server.on('error', (error: Error) => {});
server.on('toolRegistered', (name: string) => {});
server.on('toolCalled', (name: string, params: any, result: any) => {});
server.on('toolError', (name: string, params: any, error: Error) => {});
server.on('resourceRegistered', (uri: string) => {});
server.on('resourceRead', (uri: string, result: any) => {});
server.on('resourceError', (uri: string, error: Error) => {});
server.on('promptRegistered', (name: string) => {});
server.on('promptCalled', (name: string, params: any, result: any) => {});
server.on('promptError', (name: string, params: any, error: Error) => {});
server.on('projectRootChanged', (newRoot: string, previousRoot: string) => {});
```

---

## 🌐 Extension Integration

The SDK is designed to work seamlessly with Cursor/VSCode Extensions.

### Metadata Mode (`--meta` flag)

SDK supports metadata mode for Extension integration. When started with `--meta` or `--metadata` flag:

- Server outputs only JSON metadata to `stdout` (no logs)
- All logs are redirected to `stderr`
- Server exits after outputting metadata (doesn't start HTTP server)
- Useful for Extension to discover server capabilities without starting the server

**Usage:**
```bash
node dist/index.js --meta
# or
node dist/index.js --metadata
```

**Programmatic usage:**
```typescript
await server.initialize();
const metadata = server.getMetadata();
console.log(JSON.stringify(metadata, null, 2));
```

### Environment Variables

Extension automatically passes configuration via environment variables:

- `MCP_PORT` - Server port (default: 3848)
- `MCP_HOST` - Server host (default: '0.0.0.0')
- `MCP_PROJECT_ROOT` - Workspace root directory
- `MCP_CONFIG` - Configuration as JSON string
- `MCP_AUTH_TOKEN` - Authentication token/key (for auth-enabled servers)
- `MCP_PATH` - MCP endpoint path (default: '/mcp')

**Fallback Support:** SDK supports fallback to non-prefixed environment variables for server settings:
- `MCP_HOST` → `HOST` (if `MCP_HOST` is not set)
- `MCP_PORT` → `PORT` (if `MCP_PORT` is not set)
- `MCP_PROJECT_ROOT` → `CURSOR_WORKSPACE` → `PROJECT_ROOT` (if `MCP_PROJECT_ROOT` is not set)

**Priority order:** `MCP_*` env vars → non-prefixed env vars → CLI arguments → defaults

**Important:** Only environment variables with `MCP_` prefix are loaded into application configuration (via `loadConfig`). This prevents accidental exposure of system environment variables. For example, use `MCP_TIMEOUT=5000` instead of `TIMEOUT=5000`. However, server settings (host, port, project root) support fallback to non-prefixed variables for convenience.

### Extension Endpoints

SDK automatically creates endpoints for Extension:

- `GET /health` - Health check with server information
- `GET /gateway/metadata` - Get server metadata (tools, resources, prompts, config schema)
- `POST /gateway/config/project-root` - Update project root
- `GET /gateway/config/current` - Get current configuration (public config only)
- `POST /gateway/config` - Update configuration dynamically (deep merge)

### Configuration Management

**Important:** Extension configuration is updated **only by restarting the process** with new environment variables. The SDK provides read-only access via `getConfig()`.

#### Public MCP Configuration Parameters

Handlers receive **full configuration** (including secrets) in `context.config` for use in code. SDK provides `filterMcpPublicConfig()` utility to help handlers return only public MCP parameters (`mcp_*` keys) in their results.

**Example:**
```typescript
import { filterMcpPublicConfig } from '@tscodex/mcp-sdk';

// In your config schema, define public MCP parameters with 'mcp_' prefix
const ConfigSchema = Type.Object({
  // Public MCP parameters (safe to return in results)
  mcp_timeout: Type.Number({ default: 5000 }),
  mcp_api_url: Type.String({ default: 'https://api.example.com' }),
  
  // Private parameters (secrets - use in code but don't return in results)
  apiKey: Type.String(), // Secret - use in code, filter before returning
  databasePassword: Type.String() // Secret - use in code, filter before returning
});

// In handler
handler: async (params, context) => {
  // Full config access (including secrets) - use freely in code
  const timeout = context.config.timeout; // ✅ Available
  const apiKey = context.config.apiKey; // ✅ Available - use for API calls
  
  // If returning config in result, filter to public parameters only
  const publicConfig = filterMcpPublicConfig(context.config);
  // publicConfig contains only 'mcp_*' keys
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(publicConfig) // Safe - only public params
    }]
  };
}
```

This design ensures that:
- **Full config** (including secrets) is accessible in handlers for use in code
- **Public parameters** (`mcp_*` keys) can be safely returned in results using `filterMcpPublicConfig()`
- **Responsibility** for not leaking secrets in MCP responses lies with handlers

---

## 🔀 Per-Request Context (Multi-Workspace Support)

When multiple workspaces share a single MCP server process, the SDK supports **per-request context** via HTTP headers. This allows each request to have its own `projectRoot` and `workspaceId`.

### How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Workspace A   │     │   MCP Gateway   │     │   MCP Server    │
│  /projects/foo  │────▶│  (Proxy Layer)  │────▶│   (Shared)      │
└─────────────────┘     │                 │     │                 │
                        │  Adds headers:  │     │  Reads headers  │
┌─────────────────┐     │  X-MCP-Project- │     │  via AsyncLocal │
│   Workspace B   │────▶│    Root         │     │  Storage        │
│  /projects/bar  │     │  X-MCP-Workspace│     │                 │
└─────────────────┘     │    -Id          │     │                 │
                        └─────────────────┘     └─────────────────┘
```

### HTTP Headers

The SDK recognizes these headers for per-request context:

| Header | Description | Priority |
|--------|-------------|----------|
| `X-MCP-Project-Root` | Workspace project root path | Overrides `MCP_PROJECT_ROOT` env |
| `X-MCP-Workspace-Id` | Workspace identifier (optional) | Informational |

### Context Priority

`projectRoot` is resolved with the following priority:

1. **Per-request header** (`X-MCP-Project-Root`) - highest priority
2. **Server-level environment** (`MCP_PROJECT_ROOT`)
3. **undefined** if neither is set

### Usage in Handlers

```typescript
server.addTool({
  name: 'list-files',
  schema: Type.Object({}),
  handler: async (params, context) => {
    // projectRoot automatically reflects per-request header
    // or falls back to server-level MCP_PROJECT_ROOT
    const root = context.projectRoot;

    // workspaceId is available for logging/caching (optional)
    const wsId = context.workspaceId;

    if (!root) {
      return { content: [{ type: 'text', text: 'No project root configured' }] };
    }

    // Files are resolved relative to the correct workspace
    const files = await fs.readdir(root);
    return {
      content: [{ type: 'text', text: files.join('\n') }]
    };
  }
});
```

### Implementation Details

The SDK uses Node.js `AsyncLocalStorage` to propagate request context through the async call stack. This allows handlers to access per-request headers even though the official MCP SDK doesn't support custom context in handlers.

```typescript
// Available exports for advanced usage
import {
  getRequestContext,      // Get current request context
  extractRequestContext,  // Extract context from HTTP request
  requestContextStorage   // AsyncLocalStorage instance
} from '@tscodex/mcp-sdk';

// In custom middleware or transport
const reqContext = extractRequestContext(httpRequest);
// reqContext = { projectRoot?: string, workspaceId?: string }
```

### Backward Compatibility

- Servers that don't receive these headers continue to work normally
- `projectRoot` falls back to `MCP_PROJECT_ROOT` environment variable
- `workspaceId` is `undefined` when not provided
- Existing plugins don't need any changes

---

## 🏷️ Custom Context Headers

SDK allows servers to declare custom context headers that are passed with each request. This enables workspace-specific data (like project IDs, API keys, etc.) to be sent dynamically without modifying the server configuration.

### Declaring Context Headers

```typescript
const server = new McpServer({
  name: 'my-server',
  version: '1.0.0',
  description: 'Server with custom context headers',
  // Declare which headers this server accepts
  contextHeaders: ['project-id', 'api-key', 'region']
});
```

### How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MCP Manager   │     │   MCP Gateway   │     │   MCP Server    │
│  UI shows form  │     │                 │     │                 │
│  for headers:   │────▶│  Adds headers:  │────▶│  Receives in    │
│  [project-id]   │     │  X-MCP-CTX-     │     │  context.       │
│  [api-key]      │     │    project-id   │     │  contextHeaders │
│  [region]       │     │  X-MCP-CTX-     │     │                 │
│                 │     │    api-key      │     │                 │
│                 │     │  X-MCP-CTX-     │     │                 │
│                 │     │    region       │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Using in Handlers

```typescript
server.addTool({
  name: 'get-project-data',
  description: 'Fetch data for specific project',
  schema: Type.Object({}),
  handler: async (params, context) => {
    // Access context headers from the request
    const projectId = context.contextHeaders?.['project-id'];
    const apiKey = context.contextHeaders?.['api-key'];
    const region = context.contextHeaders?.['region'] || 'us-east-1';

    if (!projectId) {
      return {
        content: [{
          type: 'text',
          text: 'Error: project-id header is required. Configure it in workspace settings.'
        }]
      };
    }

    // Use the values for your business logic
    const data = await fetchProjectData(projectId, apiKey, region);

    return {
      content: [{ type: 'text', text: JSON.stringify(data) }]
    };
  }
});
```

### HTTP Headers Format

Context headers are passed with the `X-MCP-CTX-` prefix:

| Declared Header | HTTP Header | `context.contextHeaders` Key |
|-----------------|-------------|------------------------------|
| `project-id` | `X-MCP-CTX-project-id` | `project-id` |
| `api-key` | `X-MCP-CTX-api-key` | `api-key` |
| `Region` | `X-MCP-CTX-Region` | `region` (lowercase) |

### Metadata Exposure

Declared context headers are included in server metadata (`getMetadata()`), allowing MCP Manager to automatically show configuration UI for each workspace:

```typescript
const metadata = server.getMetadata();
// metadata.contextHeaders = ['project-id', 'api-key', 'region']
```

### Use Cases

- **Multi-tenant applications**: Pass tenant ID per workspace
- **External service integration**: Pass project/account IDs to map workspaces to external services
- **Region selection**: Allow different regions per workspace
- **API key override**: Different API keys for different workspaces

---

## 🔧 Utilities

### Security Utilities

```typescript
import { safePath, isPathSafe, sanitizeFilename, RateLimiter } from '@tscodex/mcp-sdk';

// Safe path resolution
const safe = safePath('/workspace', userPath); // Prevents path traversal

// Path validation
if (isPathSafe(userPath)) {
  // Safe to use
}

// Filename sanitization
const safe = sanitizeFilename(userFilename);

// Rate limiter
const limiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000
});
```

### Configuration Utilities

```typescript
import { validateConfig, updateConfig } from '@tscodex/mcp-sdk';

// Validate configuration against schema
const config = validateConfig<Config>(data, schema);

// Deep merge configurations
const merged = updateConfig(defaultConfig, extensionConfig);
```

---

## 📚 Documentation

- **[Configuration Loading Architecture](./CONFIG_LOADING.md)** - Detailed description of configuration loading and merging from various sources (CLI, ENV, files, Extension)

---

## 📝 Examples

Check the `examples/` directory for complete examples:

- **basic-server.ts** - Minimal server setup
- **with-config.ts** - Configuration management
- **with-auth.ts** - Authentication & authorization
- **with-error-handler.ts** - Custom error handling
- **file-server.ts** - File operations example

Run examples:

```bash
tsx examples/basic-server.ts
tsx examples/with-config.ts
tsx examples/with-auth.ts
```

---

## 🏗️ Architecture

### Initialization Flow

```
1. Extension starts process
   ↓ (env vars: MCP_PORT, MCP_HOST, MCP_PROJECT_ROOT, MCP_CONFIG, MCP_AUTH_TOKEN)
   
2. new McpServer(options)
   - Reads port/host/projectRoot from env vars
   - Creates HTTP Server
   - Creates MCP Server instance
   
3. server.initialize()
   - Loads configuration from MCP_CONFIG
   - Calls loadConfig() for local settings
   - Merges configurations (Extension takes priority)
   - Validates via configSchema
   - Loads session if auth is configured
   - Filters tools/resources/prompts by access
   - Sets up Extension endpoints
   - Registers MCP handlers
   
4. server.addTool/addResource/addPrompt
   - Register functionality
   
5. server.start()
   - Starts HTTP Server
   - Sets up graceful shutdown handlers
   
6. Server running
   - Handles MCP requests
   - Provides Extension endpoints
   - Configuration and session available via context
```

### Project Structure

```
@tscodex/mcp-sdk/
├── src/
│   ├── server.ts          # McpServer class
│   ├── types.ts           # TypeScript types
│   ├── config.ts          # Configuration management
│   ├── transport.ts        # HTTP transport
│   ├── security.ts         # Security utilities
│   ├── extension.ts        # Extension types
│   └── index.ts           # Main exports
├── examples/              # Example servers
└── dist/                 # Compiled output
```

---

## 🔐 Security Best Practices

1. **Always validate user input** using TypeBox schemas
2. **Use `safePath()`** for file operations to prevent path traversal
3. **Enable rate limiting** for production servers
4. **Sanitize filenames** using `sanitizeFilename()`
5. **Validate request sizes** to prevent DoS attacks
6. **Use HTTPS** in production (configured at transport level)
7. **Implement proper authentication** for sensitive operations

---

## 📄 License

MIT © [unbywyd](https://github.com/unbywyd)

---

## 🔗 Links

- [GitHub Repository](https://github.com/unbywyd/tscodex)
- [npm Package](https://www.npmjs.com/package/@tscodex/mcp-sdk)
- [MCP Protocol Specification](https://modelcontextprotocol.io)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Version**: 0.2.0  
**Status**: Production Ready
