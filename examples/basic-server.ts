/**
 * Basic MCP Server Example
 * 
 * Minimal example of creating an MCP server with TypeBox
 */

import { McpServer } from '../src/index.js';
import { Type } from '@sinclair/typebox';

// Create server with minimal configuration
const server = new McpServer({
  name: 'hello-server',
  version: '1.0.0',
  description: 'Simple hello world MCP server'
});

// Define parameter schema via TypeBox
const HelloParamsSchema = Type.Object({
  name: Type.Optional(Type.String({ 
    description: 'Name to greet',
    default: 'World'
  }))
});

// Register tool with object-based API
// params is automatically typed as { name?: string }
server.addTool({
  name: 'hello-world',
  description: 'Greet someone with a personalized message',
  schema: HelloParamsSchema,
  handler: async (params, context) => {
    // params is automatically typed! TypeScript knows the type from schema
    const name = params.name || 'World';
    const root = context.projectRoot || 'not set';
    
    return {
      content: [{
        type: 'text',
        text: `Hello, ${name}! Project root: ${root}`
      }]
    };
  }
});

// Register resource with object-based API (URI will be automatically prefixed with server ID)
server.addResource({
  uri: 'about', // Will become: hello-server://about
  name: 'About',
  description: 'Server information',
  handler: async (uri, context) => {
    return {
      contents: [{
        uri, // Use the normalized URI from handler parameter
        mimeType: 'text/plain',
        text: `Hello Server v1.0.0\nA simple MCP server example.\nProject root: ${context.projectRoot || 'not set'}`
      }]
    };
  }
});

// Note: A default "context" resource is automatically registered at hello-server://context
// It provides server metadata (name, version, description, endpoints, auth status, etc.)
// You can override it by registering your own resource with URI "context"

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
    
    // Check for --meta flag to output metadata instead of starting server
    if (process.argv.includes('--meta') || process.argv.includes('--metadata')) {
      const metadata = server.getMetadata();
      console.log(JSON.stringify(metadata, null, 2));
      process.exit(0);
    }
    
    await server.start();
    // Graceful shutdown is handled automatically by the server
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

