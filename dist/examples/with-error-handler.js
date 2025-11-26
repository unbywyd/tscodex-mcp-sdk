/**
 * MCP Server with Error Handler Middleware Example
 *
 * Demonstrates custom error handling middleware for transforming errors
 * into human-readable messages for Cursor
 */
import { McpServer, Type } from '../src/index.js';
// Custom error classes for better error handling
class FileNotFoundError extends Error {
    path;
    constructor(path) {
        super(`File not found: ${path}`);
        this.path = path;
        this.name = 'FileNotFoundError';
    }
}
class PermissionError extends Error {
    resource;
    constructor(resource) {
        super(`Permission denied: ${resource}`);
        this.resource = resource;
        this.name = 'PermissionError';
    }
}
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
// Custom error handler middleware
const errorHandler = (error, context) => {
    // Handle specific error types
    if (error instanceof FileNotFoundError) {
        return `File not found: ${error.path}. Please check the file path.`;
    }
    if (error instanceof PermissionError) {
        return `Access denied to resource "${error.resource}". Please contact administrator for access permissions.`;
    }
    if (error instanceof ValidationError) {
        return `Validation error: ${error.message}. Please check the input data.`;
    }
    // Handle timeout errors
    if (error instanceof Error && error.message.includes('timeout')) {
        return `Operation "${context.name}" took too long and was interrupted. Please try again or contact support.`;
    }
    // Handle network errors
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('network'))) {
        return `Network problem while executing "${context.name}". Please check your internet connection.`;
    }
    // Handle file system errors
    if (error instanceof Error && (error.message.includes('ENOENT') ||
        error.message.includes('EACCES') ||
        error.message.includes('file system'))) {
        return `File system access error while executing "${context.name}". Please check access permissions.`;
    }
    // Fallback: provide context-aware error message
    const errorMessage = error instanceof Error
        ? error.message
        : String(error);
    const typeName = context.type === 'tool' ? 'tool'
        : context.type === 'resource' ? 'resource'
            : 'prompt';
    return `An error occurred while executing ${typeName} "${context.name}": ${errorMessage}. If the problem persists, please contact support.`;
};
// Create server with error handler
const server = new McpServer({
    name: 'error-handler-server',
    version: '1.0.0',
    description: 'Server with custom error handling middleware',
    errorHandler: errorHandler,
    logger: {
        info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
        debug: (msg, ...args) => console.debug(`[DEBUG] ${msg}`, ...args)
    }
});
// Tool that throws FileNotFoundError
server.addTool({
    name: 'read-file',
    description: 'Read a file (may throw FileNotFoundError)',
    schema: Type.Object({
        path: Type.String({ description: 'File path to read' })
    }),
    handler: async (params) => {
        // Simulate file not found
        if (!params.path.includes('.')) {
            throw new FileNotFoundError(params.path);
        }
        return {
            content: [{
                    type: 'text',
                    text: `File ${params.path} read successfully`
                }]
        };
    }
});
// Tool that throws PermissionError
server.addTool({
    name: 'delete-file',
    description: 'Delete a file (may throw PermissionError)',
    schema: Type.Object({
        path: Type.String({ description: 'File path to delete' })
    }),
    handler: async (params) => {
        // Simulate permission error
        if (params.path.startsWith('/system')) {
            throw new PermissionError(params.path);
        }
        return {
            content: [{
                    type: 'text',
                    text: `File ${params.path} deleted successfully`
                }]
        };
    }
});
// Tool that throws ValidationError
server.addTool({
    name: 'validate-email',
    description: 'Validate email address',
    schema: Type.Object({
        email: Type.String({ description: 'Email to validate' })
    }),
    handler: async (params) => {
        if (!params.email.includes('@')) {
            throw new ValidationError('Email must contain @ symbol');
        }
        return {
            content: [{
                    type: 'text',
                    text: `Email ${params.email} is valid`
                }]
        };
    }
});
// Tool that throws generic error
server.addTool({
    name: 'divide-numbers',
    description: 'Divide two numbers',
    schema: Type.Object({
        a: Type.Number({ description: 'First number' }),
        b: Type.Number({ description: 'Second number' })
    }),
    handler: async (params) => {
        if (params.b === 0) {
            throw new Error('Division by zero');
        }
        return {
            content: [{
                    type: 'text',
                    text: `Result: ${params.a / params.b}`
                }]
        };
    }
});
// Resource that may throw errors (URI will be automatically prefixed with server ID)
server.addResource({
    uri: 'example', // Will become: error-handler-server://example
    name: 'Example File',
    description: 'Example resource that may throw errors',
    handler: async (uri) => {
        if (uri.includes('not-found')) {
            throw new FileNotFoundError(uri);
        }
        return {
            contents: [{
                    uri, // Use the normalized URI from handler parameter
                    mimeType: 'text/plain',
                    text: 'Resource content'
                }]
        };
    }
});
// Events
server.on('started', (port, host) => {
    console.log(`✅ Server started on ${host}:${port}`);
    console.log(`📡 MCP endpoint: http://${host}:${port}/mcp`);
    console.log(`💚 Health check: http://${host}:${port}/health`);
    console.log('\n📝 Test error handling:');
    console.log('   - Call read-file with invalid path to see FileNotFoundError');
    console.log('   - Call delete-file with /system/path to see PermissionError');
    console.log('   - Call validate-email with invalid email to see ValidationError');
    console.log('   - Call divide-numbers with b=0 to see generic error handling');
});
server.on('stopped', () => {
    console.log('🛑 Server stopped');
});
server.on('error', (error) => {
    console.error('❌ Server error:', error);
});
server.on('toolError', (name, params, error) => {
    console.log(`⚠️ Tool error: ${name}`, params, error);
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
//# sourceMappingURL=with-error-handler.js.map