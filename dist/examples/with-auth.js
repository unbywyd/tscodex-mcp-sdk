/**
 * MCP Server with Authentication & Authorization Example
 *
 * Demonstrates role-based access control with session management
 */
import { McpServer, Type } from '../src/index.js';
// Define roles
var Roles;
(function (Roles) {
    Roles["ADMIN"] = "admin";
    Roles["USER"] = "user";
    Roles["GUEST"] = "guest";
})(Roles || (Roles = {}));
// Configuration schema
const ConfigSchema = Type.Object({
    adminEmails: Type.Array(Type.String({ format: 'email' }), { default: [] }),
    allowGuests: Type.Boolean({ default: false }),
    maxFileSize: Type.Number({ default: 1024 * 1024 })
});
// Session schema
const SessionSchema = Type.Object({
    email: Type.String({ format: 'email' }),
    role: Type.Enum(Roles)
});
// Create server with authentication
const server = new McpServer({
    name: 'secure-server',
    version: '1.0.0',
    description: 'Server with role-based access control',
    configSchema: ConfigSchema,
    loadConfig: async () => {
        // Load local configuration
        return {
            adminEmails: ['admin@example.com'],
            allowGuests: false,
            maxFileSize: 5 * 1024 * 1024
        };
    },
    auth: {
        roles: {
            // Guard with access to loaded configuration
            admin: (session, context) => {
                // context.config is already loaded!
                const allowedAdmins = context.config.adminEmails;
                return session.role === Roles.ADMIN &&
                    allowedAdmins.includes(session.email);
            },
            user: async (session, context) => {
                // Async check with configuration access
                if (session.role !== Roles.USER)
                    return false;
                // Example: could check via external API
                // const apiUrl = context.config.validationApiUrl;
                // if (apiUrl) {
                //   return await validateUserViaApi(apiUrl, session.email);
                // }
                return true;
            },
            guest: (session, context) => {
                // Guests only if enabled in config
                return context.config.allowGuests === true;
            }
        },
        sessionSchema: SessionSchema,
        requireSession: true,
        // REQUIRED: Transform token/key from MCP_AUTH_TOKEN into full session object
        loadSession: async (token, context) => {
            // In this example, we simulate token validation
            // In real scenario, you would:
            // 1. Validate token via API
            // 2. Fetch user data from database/API
            // 3. Return full session object
            // Example: Parse token as JSON (if token is base64 encoded session)
            try {
                const decoded = Buffer.from(token, 'base64').toString('utf-8');
                const sessionData = JSON.parse(decoded);
                return sessionData;
            }
            catch {
                // If not base64, treat as direct JSON string
                try {
                    return JSON.parse(token);
                }
                catch {
                    // If token is just a key, fetch session from API
                    // const response = await fetch(`${context.config.apiUrl}/session/${token}`);
                    // return await response.json() as Session;
                    // For demo: create session from token
                    // In production, validate token and fetch real session
                    throw new Error('Invalid token format. Expected base64 encoded JSON or JSON string.');
                }
            }
        }
    }
});
// Admin-only tool
server.addTool({
    name: 'delete-all',
    description: 'Delete all files (admin only)',
    schema: Type.Object({}),
    access: [Roles.ADMIN],
    handler: async (params, context) => {
        // context.session.email is available and typed!
        const email = context.session.email;
        console.log(`Admin ${email} is deleting all files`);
        return {
            content: [{
                    type: 'text',
                    text: `All files deleted by ${email}`
                }]
        };
    }
});
// Admin and user tool
server.addTool({
    name: 'read-file',
    description: 'Read a file',
    schema: Type.Object({
        path: Type.String({ description: 'File path to read' })
    }),
    access: [Roles.ADMIN, Roles.USER],
    handler: async (params, context) => {
        const email = context.session.email;
        return {
            content: [{
                    type: 'text',
                    text: `Reading file ${params.path} for user ${email}`
                }]
        };
    }
});
// Public tool (no access restriction)
server.addTool({
    name: 'hello',
    description: 'Say hello (public)',
    schema: Type.Object({}),
    // No access - available to everyone, even without session
    handler: async (params, context) => {
        const name = context.session?.email || 'Anonymous';
        return {
            content: [{
                    type: 'text',
                    text: `Hello, ${name}!`
                }]
        };
    }
});
// Admin-only resource (URI will be automatically prefixed with server ID)
server.addResource({
    uri: 'secrets', // Will become: secure-server://secrets
    name: 'Admin Secrets',
    description: 'Admin-only secret resource',
    access: [Roles.ADMIN],
    handler: async (uri, context) => {
        return {
            contents: [{
                    uri,
                    mimeType: 'text/plain',
                    text: `Secret data for ${context.session.email}`
                }]
        };
    }
});
// Public resource (URI will be automatically prefixed with server ID)
server.addResource({
    uri: 'about', // Will become: secure-server://about
    name: 'About',
    description: 'Public server information',
    // No access - public
    handler: async (uri, context) => {
        return {
            contents: [{
                    uri,
                    mimeType: 'text/plain',
                    text: `Secure Server v1.0.0\nUser: ${context.session?.email || 'Anonymous'}`
                }]
        };
    }
});
// Admin-only prompt
server.addPrompt({
    name: 'admin-command',
    description: 'Execute admin command',
    arguments: Type.Object({
        command: Type.String({ description: 'Command to execute' })
    }),
    access: [Roles.ADMIN],
    handler: async (params, context) => {
        return {
            messages: [{
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `Admin ${context.session.email} wants to execute: ${params.command}`
                    }
                }]
        };
    }
});
// Events
server.on('started', (port, host) => {
    console.log(`✅ Server started on ${host}:${port}`);
    console.log(`📡 MCP endpoint: http://${host}:${port}/mcp`);
    console.log(`💚 Health check: http://${host}:${port}/health`);
});
server.on('stopped', () => {
    console.log('🛑 Server stopped');
});
server.on('error', (error) => {
    console.error('❌ Server error:', error);
});
server.on('toolCalled', (name, params) => {
    console.log(`🔧 Tool called: ${name}`, params);
});
// Start
async function main() {
    try {
        await server.initialize();
        await server.start();
        console.log('\n📝 To test with authentication, set MCP_AUTH_TOKEN environment variable:');
        console.log('   MCP_AUTH_TOKEN=\'your-auth-token-here\'');
        console.log('   Note: The token will be processed by loadSession() to get full session object');
        // Graceful shutdown is handled automatically by the server
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=with-auth.js.map