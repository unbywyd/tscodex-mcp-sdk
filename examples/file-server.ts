/**
 * File Server Example
 * 
 * Example server for working with files relative to project root
 */

import { McpServer, Type } from '../src/index.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { safePath } from '../src/security.js';

const server = new McpServer({
  name: 'file-server',
  version: '1.0.0',
  description: 'MCP server for file operations'
});

// Define parameter schemas via TypeBox
const ReadFileParamsSchema = Type.Object({
  filePath: Type.String({
    description: 'File path relative to project root'
  })
});

const WriteFileParamsSchema = Type.Object({
  filePath: Type.String({
    description: 'File path relative to project root'
  }),
  content: Type.String({
    description: 'File content to write'
  })
});

const ListFilesParamsSchema = Type.Object({
  dirPath: Type.Optional(Type.String({
    description: 'Directory path relative to project root (empty for root)'
  }))
});

// Read file
server.addTool({
  name: 'read_file',
  description: 'Read file from project root',
  schema: ReadFileParamsSchema,
  handler: async (params, context) => {
    const root = context.projectRoot;
    
    if (!root) {
      throw new Error('Project root not set. Please use MCP Manager Extension.');
    }

    // Use safe path resolution
    const fullPath = safePath(root, params.filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      
      return {
        content: [{
          type: 'text',
          text: content
        }]
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }
});

// Write file
server.addTool({
  name: 'write_file',
  description: 'Write file to project root',
  schema: WriteFileParamsSchema,
  handler: async (params, context) => {
    const root = context.projectRoot;
    
    if (!root) {
      throw new Error('Project root not set');
    }

    // Use safe path resolution
    const fullPath = safePath(root, params.filePath);

    try {
      // Create directories if needed
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, params.content, 'utf-8');
      
      return {
        content: [{
          type: 'text',
          text: `File written successfully: ${params.filePath}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to write file: ${error}`);
    }
  }
});

// List files
server.addTool({
  name: 'list_files',
  description: 'List files in directory',
  schema: ListFilesParamsSchema,
  handler: async (params, context) => {
    const root = context.projectRoot;
    
    if (!root) {
      throw new Error('Project root not set');
    }

    const dirPath = params.dirPath || '';
    // Use safe path resolution
    const fullPath = safePath(root, dirPath);

    try {
      const files = await fs.readdir(fullPath, { withFileTypes: true });
      const fileList = files.map(file => ({
        name: file.name,
        type: file.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, file.name)
      }));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(fileList, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`);
    }
  }
});

// Resource for project root information (URI will be automatically prefixed with server ID)
server.addResource({
  uri: 'project-root', // Will become: file-server://project-root
  name: 'Project Root Info',
  description: 'Information about project root directory',
  handler: async (uri, context) => {
    const root = context.projectRoot;
    
    if (!root) {
      return {
        contents: [{
          uri, // Use the normalized URI from handler parameter
          mimeType: 'text/plain',
          text: 'Project root not set. Please use MCP Manager Extension.'
        }]
      };
    }

    try {
      const stats = await fs.stat(root);
      
      return {
        contents: [{
          uri, // Use the normalized URI from handler parameter
          mimeType: 'application/json',
          text: JSON.stringify({
            path: root,
            exists: true,
            isDirectory: stats.isDirectory(),
            created: stats.birthtime,
            modified: stats.mtime
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri, // Use the normalized URI from handler parameter
          mimeType: 'text/plain',
          text: `Project root: ${root} (error: ${error})`
        }]
      };
    }
  }
});

// Events
server.on('started', (port, host) => {
  console.log(`✅ Server started on ${host}:${port}`);
  console.log(`📁 Project root: ${server.getProjectRoot() || 'not set'}`);
});

server.on('projectRootChanged', (newRoot, oldRoot) => {
  console.log(`📁 Project root changed: ${oldRoot} -> ${newRoot}`);
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

