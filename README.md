# @tscodex/mcp-sdk

> **TypeScript SDK for creating LLM tools based on Model Context Protocol**

[![npm version](https://img.shields.io/npm/v/@tscodex/mcp-sdk)](https://www.npmjs.com/package/@tscodex/mcp-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Website**: [tscodex.com](https://tscodex.com)

---

## 🎯 About the Project

`@tscodex/mcp-sdk` is a TypeScript SDK for quickly creating MCP (Model Context Protocol) servers. The project serves as the foundation for building LLM tools, the first of which is **MCP Manager** — a desktop application for managing MCP servers with a visual interface.

### TSCodex Ecosystem

```
┌─────────────────────────────────────────────────────────────┐
│                    TSCodex Ecosystem                        │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   MCP SDK    │───▶│ MCP Manager  │───▶│ Cursor Bridge│  │
│  │  (Core)      │    │  (Desktop)   │    │  (Extension) │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                            │                                │
│                    ┌───────▼────────┐                        │
│                    │  MCP Servers  │                        │
│                    │  (Examples)   │                        │
│                    └───────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Quick Links


**[📦 MCP Manager](https://github.com/unbywyd/tscodex-mcp-manager-app)** — Desktop application for managing MCP servers  
**[🌉 Cursor Bridge](https://github.com/unbywyd/tscodex-msp-manager-bridge)** — Extension for Cursor/VS Code

---

## 💡 Project Essence

**TSCodex** is a platform for creating LLM tools. The SDK provides core functionality for quickly creating MCP servers via HTTP, without requiring MCP Manager. Servers can be run via `npx`, passing ENV parameters directly.

### Key Features

- ✅ **Rapid Development** — Create MCP servers in minutes
- ✅ **HTTP Transport** — Standard HTTP for integration
- ✅ **Type-safe API** — Full typing with TypeBox
- ✅ **Flexible Configuration** — Extension and local settings support
- ✅ **Security** — Built-in protection mechanisms
- ✅ **AI Integration** — Ready-to-use client for AI providers
- ✅ **Multi-workspace** — Support for multiple workspaces

### How It Works

```
┌─────────────────┐
│   MCP Server    │  ← Built on SDK
│  (npm package)  │
└────────┬────────┘
         │
         ├───▶ Run via npx (standalone)
         │     └─▶ Pass ENV parameters
         │
         └───▶ Run via MCP Manager
               ├─▶ Visual configuration
               ├─▶ Secrets management
               ├─▶ Access control
               └─▶ Usage statistics
```

---

## 🚀 MCP Manager — First Tool in the Ecosystem

**MCP Manager** is a desktop application that manages MCP servers, allows configuring them, passing secrets, authorization, AI agent, and creating dynamic tools/resources for MCP.

### Why MCP Manager?

When working with Cursor, each open project requires its own workspace. For example, the [@tscodex/mcp-images](https://github.com/unbywyd/tscodex-mcp-images) server works with images and requires the path to the current project's root directory. MCP Manager enables:

- **One Server, Multiple Workspaces** — One server can work with different projects
- **Automatic Registration** — Cursor Bridge automatically registers workspace by project path
- **Proxying** — Each workspace gets its own proxy to the server
- **Perfect Encapsulation** — Complete isolation between workspaces

### Workspace Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Manager                               │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                │
│  │   Server     │─────────▶│  Workspace A  │                │
│  │  (Images)    │         │  /project/foo │                │
│  └──────────────┘         └───────────────┘                │
│         │                                                   │
│         │         ┌──────────────┐                          │
│         └────────▶│  Workspace B │                          │
│                   │  /project/bar│                          │
│                   └──────────────┘                          │
│                                                              │
│  SDK receives headers from current workspace                │
│  and allows one server to be used with different WS        │
└─────────────────────────────────────────────────────────────┘
```

### MCP Manager Features

#### 🎨 Visual Interface

MCP Manager provides a full-featured UI for server management:

- **Metadata View** — Display tools, resources, prompts
- **JSON Configuration Schema** — Automatic settings detection
- **UI Configuration** — Convenient forms for configuration
- **Lifecycle Management** — Start, stop, restart servers

#### 🔐 Secrets Management (3 Levels)

```
┌─────────────────────────────────────────┐
│      Global Secrets                    │  ← Level 1
│  (Applied to all workspaces)           │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│    Workspace Secrets                    │  ← Level 2
│  (Override global)                      │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│    Server Secrets                       │  ← Level 3
│  (Highest priority)                     │
└─────────────────────────────────────────┘
```

**Security:**
- Secrets stored in OS keychain (Windows Credential Store, macOS Keychain, Linux GNOME Keyring)
- Never stored in plain text
- Passed only via environment variables

#### 🛡️ Permissions System

Flexible access control system:

| Category | Controls |
|----------|----------|
| **Environment** | System environment variables |
| **Context** | Workspace/session information |
| **Secrets** | Available secret keys |
| **AI Access** | Access to AI agent |

**Environment Configuration Example:**
- ✅ Allow PATH — `PATH`, `PATHEXT`
- ✅ Allow Home — `HOME`, `USERPROFILE`
- ✅ Allow Node — `NODE_*`, `npm_*`
- ⚙️ Custom Allowlist — Specific variables

**Secrets Configuration Example:**
- 🔒 None — Secrets are not passed
- 📋 Allowlist — Only specified keys
- 🔓 All — All secrets from store

#### 🤖 AI Agent

MCP Manager provides an OpenAI-compatible proxy for MCP servers:

**How It Works:**
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ MCP Server   │───▶│ AI Proxy     │───▶│ AI Provider  │
│              │    │ (Manager)    │    │ (OpenAI/etc) │
└──────────────┘    └──────────────┘    └──────────────┘
     │                    │                    │
     │                    │                    │
     └─▶ MCP_AI_PROXY_URL │                    │
     └─▶ MCP_AI_PROXY_TOKEN                    │
                                               │
                                    Keys are NOT passed
                                    to server directly!
```

**Features:**
- Support for any OpenAI-compatible APIs (OpenAI, OpenRouter, Ollama, etc.)
- Configuration via Base URL and API Key
- Access control at server level
- Model restrictions (Allowed Models)
- Rate limiting (max requests per minute)
- **Token Statistics** — Full transparency of usage

**Usage in SDK:**
```typescript
import { getAIClient } from '@tscodex/mcp-sdk';

const ai = getAIClient();

if (await ai.isAvailable()) {
  const result = await ai.complete('Summarize this text...');
}
```

#### 🛠️ MCP Tools — Dynamic Server

MCP Manager includes a built-in **MCP Tools server** that allows creating tools, resources, and prompts without writing a separate package.

**Tool Types:**

1. **Static** — Returns fixed content
2. **HTTP** — Executes HTTP requests
3. **Function** — Executes JavaScript code

**AI-Assisted Generation:**
- **✨ AI** button when creating tools/resources
- Generate definitions from natural language
- AI agent integration for form filling

**HTTP Tool Example:**
```json
{
  "name": "get_weather",
  "description": "Get weather for a city",
  "executor": {
    "type": "http",
    "method": "GET",
    "url": "https://api.weather.com/v1/weather?city={{city}}&key={{SECRET_WEATHER_KEY}}"
  }
}
```

**Available Context in Function Executor:**
```javascript
async (params, context) => {
  // Request parameters
  const { param1, param2 } = params;
  
  // Session context
  context.session.workspaceId;   // Current workspace ID
  context.session.projectRoot;  // Project path
  context.session.clientType;   // Client type (cursor, claude-code)
  
  // Request context
  context.request.timestamp;     // Unix timestamp
  context.request.requestId;     // Unique request ID
  
  // Utilities
  await context.utils.fetch(url, options);
  context.utils.log(message);
  
  return { result: "..." };
}
```

#### 📊 Statistics and Monitoring

- **AI Usage** — Total requests and tokens
- **Per-Server Breakdown** — Statistics for each server
- **Request History** — Log of all AI requests
- **Transparency** — Full visibility of resource usage

---

## 🌉 Cursor Bridge — IDE Integration

**Cursor Bridge** is an extension for Cursor/VS Code that provides seamless integration with MCP Manager.

### Bridge Features

- **Automatic Registration** — Automatically registers workspace in MCP Manager by project path
- **Synchronization** — Synchronizes Cursor with MCP Manager
- **Automatic Configuration** — Registers MCP server proxies in local `mcp.json`
- **Perfect Encapsulation** — Complete isolation between workspaces

### How It Works

```
┌─────────────────┐
│  Cursor/VS Code │
│  (project open)  │
└────────┬────────┘
         │
         │ 1. Bridge detects project path
         ▼
┌─────────────────┐
│  Cursor Bridge  │
│  (Extension)    │
└────────┬────────┘
         │
         │ 2. Registers workspace in MCP Manager
         │ 3. Gets list of available servers
         │ 4. Updates mcp.json
         ▼
┌─────────────────┐
│  MCP Manager    │
│  (Desktop App)  │
└─────────────────┘
```

---

## 📦 SDK Installation

```bash
npm install @tscodex/mcp-sdk
```

**Requirements:**
- Node.js >= 18.0.0
- TypeScript >= 5.0.0

---

## 🚀 Quick Start

### Minimal Server

```typescript
import { McpServer, Type } from '@tscodex/mcp-sdk';

const server = new McpServer({
  name: 'hello-server',
  version: '1.0.0',
  description: 'Simple hello world MCP server'
});

// Define schema with TypeBox
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

### Running the Server

**Standalone (via npx):**
```bash
npx @tscodex/mcp-images
```

**With ENV parameters:**
```bash
MCP_PORT=3848 MCP_PROJECT_ROOT=/path/to/project npx @tscodex/mcp-images
```

**Via MCP Manager:**
1. Install MCP Manager
2. Add server via UI
3. Configure workspace
4. Start server

---

## 📚 Core SDK Features

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
    // context.config contains full configuration including secrets
    const timeout = context.config.timeout;
    const apiKey = context.config.apiKey;
    
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
        const allowedAdmins = context.config.adminEmails || [];
        return session.role === Roles.ADMIN && 
               allowedAdmins.includes(session.email);
      },
      user: async (session, context) => {
        return session.role === Roles.USER;
      }
    },
    sessionSchema: SessionSchema,
    requireSession: true,
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
  access: [Roles.ADMIN], // Only admins can use
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
        uri,
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

### 4. AI Client

SDK provides a ready-to-use client for working with AI providers via MCP Manager:

```typescript
import { getAIClient } from '@tscodex/mcp-sdk';

const ai = getAIClient();

// Always check availability before using
if (await ai.isAvailable()) {
  // Simple completion
  const result = await ai.complete('Summarize this text...');

  // Or full chat API
  const response = await ai.chat({
    messages: [{ role: 'user', content: 'Hello!' }],
    temperature: 0.7,
  });
}
```

**Usage in Tools:**
```typescript
server.addTool({
  name: 'summarize',
  description: 'Summarize text using AI',
  schema: Type.Object({
    text: Type.String({ description: 'Text to summarize' }),
  }),
  handler: async ({ text }) => {
    // Graceful degradation when AI is not available
    if (!await ai.isAvailable()) {
      return {
        content: [{ type: 'text', text: 'AI summarization is not available' }],
        isError: true,
      };
    }

    const summary = await ai.completeWithSystem(
      'You are a helpful assistant that creates concise summaries.',
      `Please summarize the following text:\n\n${text}`
    );

    return {
      content: [{ type: 'text', text: summary }],
    };
  },
});
```

### 5. Multi-Workspace Support

SDK supports working with multiple workspaces via HTTP headers:

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

**HTTP Headers:**
- `X-MCP-Project-Root` — Path to workspace project root
- `X-MCP-Workspace-Id` — Workspace identifier (optional)

---

## 🔀 Per-Request Context (Multi-Workspace Support)

When multiple workspaces share a single MCP server process, the SDK supports **per-request context** via HTTP headers. This allows each request to have its own `projectRoot` and `workspaceId`.

### How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Workspace A   │     │   MCP Gateway   │     │   MCP Server    │
│  /projects/foo  │────▶│  (Proxy Layer)  │────▶│   (Shared)      │
└─────────────────┘     │                 │     │                 │
                        │  Adds headers:  │     │  Reads via      │
┌─────────────────┐     │  X-MCP-Project- │     │  AsyncLocal     │
│   Workspace B   │────▶│    Root         │     │  Storage        │
│  /projects/bar  │     │  X-MCP-Workspace│     │                 │
└─────────────────┘     │    -Id          │     │                 │
                        └─────────────────┘     └─────────────────┘
```

### Context Priority

`projectRoot` is resolved with the following priority:

1. **Per-request header** (`X-MCP-Project-Root`) — highest priority
2. **Server-level environment** (`MCP_PROJECT_ROOT`)
3. **undefined** if neither is set

---

## 🌐 Extension Integration

SDK is designed for seamless work with Cursor/VSCode extensions.

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

### Environment Variables

Extension automatically passes configuration via environment variables:

- `MCP_PORT` - Server port (default: 3848)
- `MCP_HOST` - Server host (default: '0.0.0.0')
- `MCP_PROJECT_ROOT` - Workspace root directory
- `MCP_CONFIG` - Configuration as JSON string
- `MCP_AUTH_TOKEN` - Authentication token (for auth-enabled servers)
- `MCP_PATH` - MCP endpoint path (default: '/mcp')
- `MCP_AI_PROXY_URL` - AI proxy endpoint URL (for AI Client)
- `MCP_AI_PROXY_TOKEN` - AI proxy authentication token (for AI Client)

**Important:** Only environment variables with `MCP_` prefix are loaded into application configuration (via `loadConfig`). This prevents accidental exposure of system environment variables.

### Extension Endpoints

SDK automatically creates endpoints for Extension:

- `GET /health` - Health check with server information
- `GET /gateway/metadata` - Get server metadata (tools, resources, prompts, config schema)
- `POST /gateway/config/project-root` - Update project root
- `GET /gateway/config/current` - Get current configuration (public only)
- `POST /gateway/config` - Update configuration dynamically (deep merge)

---

## 🔐 Security

### Built-in Protection Mechanisms

- ✅ **Input Validation** — TypeBox schemas for all parameters
- ✅ **Path Sanitization** — Protection against path traversal attacks
- ✅ **Rate Limiting** — Request rate limiting
- ✅ **Request Size Validation** — Protection against DoS attacks
- ✅ **Secrets Management** — Secure secret storage
- ✅ **Permission System** — Granular access control

### Best Practices

1. **Always validate user input** using TypeBox schemas
2. **Use `safePath()`** for file operations to prevent path traversal
3. **Enable rate limiting** for production servers
4. **Sanitize filenames** using `sanitizeFilename()`
5. **Validate request sizes** to prevent DoS attacks
6. **Use HTTPS** in production (configured at transport level)
7. **Implement proper authentication** for sensitive operations

---

## 📖 API Reference

### `McpServer<TConfig, TRoles, TSession>`

Main server class.

#### Constructor

```typescript
interface McpServerOptions<TConfig, TRoles, TSession> {
  // REQUIRED
  name: string;                    // Unique server name (must start with Latin letter)
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
server.getMetadata(): ServerMetadata;  // Get server metadata

// Properties
server.serverId: string;           // Server ID (resource prefix)
server.serverPort: number;         // Server port
server.serverHost: string;         // Server host
server.running: boolean;             // Is server running
```

---

## 📝 Examples

Check the `examples/` directory for complete examples:

- **basic-server.ts** - Minimal server setup
- **with-config.ts** - Configuration management
- **with-auth.ts** - Authentication & authorization
- **with-error-handler.ts** - Custom error handling
- **file-server.ts** - File operations example
- **with-ai-client.ts** - AI Client integration example

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
│   ├── ai-client.ts        # AI Client
│   └── index.ts           # Main exports
├── examples/              # Example servers
└── dist/                 # Compiled output
```

---

## 🍎 Platform Notes

### Windows

- ✅ Full support
- ✅ Uses Windows Credential Store for secrets
- ✅ No additional setup required

### macOS

- ⚠️ **Code signing required** for distribution
- ✅ Uses Keychain for secrets
- 📝 Developers can generate signature themselves as all necessary resources are available
- 📧 If someone wants to help with signing or collaborate — please contact me

### Linux

- ✅ Full support
- ✅ Requires `libsecret-1-dev` and GNOME Keyring or KDE Wallet
- 📦 Install: `sudo apt install libsecret-1-dev gnome-keyring`

---

## 🔗 Links

### Main Projects

- **[MCP Manager](https://github.com/unbywyd/tscodex-mcp-manager-app)** — Desktop application for managing MCP servers
- **[Cursor Bridge](https://github.com/unbywyd/tscodex-msp-manager-bridge)** — Extension for Cursor/VS Code
- **[npm Package](https://www.npmjs.com/package/@tscodex/mcp-sdk)** — SDK package on npm

### Example Servers

- **[@tscodex/mcp-images](https://github.com/unbywyd/tscodex-mcp-images)** — Image processing, stock search, AI generation
- **[@tscodex/mcp-server-example](https://www.npmjs.com/package/@tscodex/mcp-server-example)** — SDK examples and best practices

### Documentation

- **[Website](https://tscodex.com)** — Official website
- **[MCP Protocol Specification](https://modelcontextprotocol.io)** — MCP protocol specification

---

## 📄 License

MIT © [unbywyd](https://github.com/unbywyd)

---

## 🤝 Collaboration

If you want to help with the project, especially with code signing for macOS or other aspects, please contact me!

---

**Version**: 0.0.6  
**Status**: Production Ready
