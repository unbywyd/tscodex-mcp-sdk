/**
 * MCP Server with Configuration Example
 *
 * Example server with TypeBox configuration
 */
import { McpServer, Type } from '../src/index.js';
// Define configuration schema via TypeBox
const ConfigSchema = Type.Object({
    apiKey: Type.String({
        minLength: 10,
        description: 'API key for external service'
    }),
    timeout: Type.Number({
        default: 5000,
        minimum: 1000,
        maximum: 60000,
        description: 'Request timeout in milliseconds'
    }),
    retries: Type.Number({
        default: 3,
        minimum: 0,
        maximum: 10,
        description: 'Number of retry attempts'
    }),
    enabled: Type.Boolean({
        default: true,
        description: 'Enable/disable server features'
    })
}, {
    required: ['apiKey']
});
// Configuration processing function
// SDK automatically parses CLI args, ENV vars, and config file
// This function receives parsed config and can process/transform it
async function processConfig(parsedConfig) {
    // SDK already parsed CLI args, ENV vars, and config file
    // You can add custom processing here if needed
    // For example, set defaults for missing values
    return {
        apiKey: parsedConfig.apiKey || 'default-key',
        timeout: parsedConfig.timeout ?? 5000,
        retries: parsedConfig.retries ?? 3,
        enabled: parsedConfig.enabled ?? true
    };
}
// Create server with configuration
const server = new McpServer({
    name: 'api-server',
    version: '1.0.0',
    description: 'MCP server for external API integration',
    configSchema: ConfigSchema, // TypeBox schema for parsing/validation
    configFile: '.api-server.json', // Optional: default config file path
    loadConfig: processConfig // Optional: process parsed config
});
// Define parameter schema for tool
const MakeRequestParamsSchema = Type.Object({
    url: Type.String({
        format: 'uri',
        description: 'URL to make request to'
    })
});
// Tool with typed parameters
server.addTool({
    name: 'make-request',
    description: 'Make HTTP request with configured timeout and retries',
    schema: MakeRequestParamsSchema,
    handler: async (params, context) => {
        // params is automatically typed as { url: string }
        const config = context.config;
        if (!config.enabled) {
            throw new Error('Server is disabled in configuration');
        }
        // Use timeout and retries from configuration
        console.log(`Making request to ${params.url}`);
        console.log(`Timeout: ${config.timeout}ms, Retries: ${config.retries}`);
        return {
            content: [{
                    type: 'text',
                    text: `Request to ${params.url} completed with timeout ${config.timeout}ms`
                }]
        };
    }
});
// Resource for current configuration (URI will be automatically prefixed with server ID)
// IMPORTANT: Never return full configuration from resources/tools/prompts!
// Use filterSecrets() utility to filter sensitive data
server.addResource({
    uri: 'current', // Will become: api-server://current
    name: 'Current Configuration',
    description: 'Server configuration (safe, non-sensitive fields only)',
    handler: async (uri, context) => {
        // IMPORTANT: Filter secrets before returning configuration
        // SDK provides filterSecrets() utility for this purpose
        const { filterSecrets } = await import('../src/security.js');
        const safeConfig = filterSecrets(context.config);
        // Only return non-sensitive configuration fields
        const publicConfig = {
            timeout: safeConfig.timeout,
            retries: safeConfig.retries,
            enabled: safeConfig.enabled
            // apiKey is already filtered by filterSecrets() to '***'
        };
        return {
            contents: [{
                    uri, // Use the normalized URI from handler parameter
                    mimeType: 'application/json',
                    text: JSON.stringify(publicConfig, null, 2)
                }]
        };
    }
});
// Events
server.on('started', (port, host) => {
    console.log(`✅ Server started on ${host}:${port}`);
    const config = server.getConfig();
    console.log(`⚙️  Configuration:`, {
        timeout: config.timeout,
        retries: config.retries,
        enabled: config.enabled,
        apiKey: '***'
    });
});
server.on('toolCalled', (name, params) => {
    console.log(`🔧 Tool called: ${name}`, params);
});
// Start
async function main() {
    try {
        await server.initialize();
        await server.start();
        // Graceful shutdown is handled automatically by the server
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=with-config.js.map