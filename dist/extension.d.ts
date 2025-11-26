/**
 * Extension integration types and utilities
 *
 * Types for Extension API communication
 */
/**
 * MCP Server information for Extension
 */
export interface McpServerInfo {
    name: string;
    version: string;
    description: string;
    url: string;
    healthUrl: string;
    extensionEndpoints: {
        updateProjectRoot: string;
        getConfig: string;
    };
}
/**
 * Health check response (hello endpoint)
 */
export interface HealthResponse {
    status: 'ok' | 'error';
    server: string;
    version: string;
    description?: string;
    uptime: number;
    connections?: number;
    protocolVersion?: string;
    protocol?: {
        name: string;
        version: string;
        description: string;
    };
    endpoints?: {
        mcp: string;
        health: string;
        config?: string;
        projectRoot?: string;
    };
    error?: string;
    auth?: {
        required: boolean;
        session?: unknown;
        sessionValid: boolean;
    };
}
/**
 * Config response (without secrets)
 */
export interface ConfigResponse {
    [key: string]: unknown;
}
/**
 * Update project root request
 */
export interface UpdateProjectRootRequest {
    projectRoot: string;
}
/**
 * Update project root response
 */
export interface UpdateProjectRootResponse {
    success: boolean;
    message: string;
    previousRoot?: string;
    newRoot: string;
}
/**
 * Extension endpoint definition
 */
export interface ExtensionEndpoint {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    description: string;
}
/**
 * Server metadata structure
 *
 * Complete server information including tools, resources, prompts,
 * configuration, and authentication status.
 * Can be obtained without starting the server by calling getMetadata()
 * after initialize().
 */
export interface ServerMetadata {
    server: {
        name: string;
        version: string;
        description: string;
        id: string;
        protocolVersion: string;
    };
    tools: Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        access?: string[];
    }>;
    resources: Array<{
        uri: string;
        name: string;
        description: string;
        mimeType?: string;
        access?: string[];
    }>;
    prompts: Array<{
        name: string;
        description: string;
        arguments?: Record<string, unknown>;
        access?: string[];
    }>;
    config?: {
        schema?: Record<string, unknown>;
        loaded: boolean;
        hasConfig: boolean;
    };
    auth?: {
        required: boolean;
        hasSession: boolean;
        roles?: string[];
    };
    projectRoot?: string;
}
//# sourceMappingURL=extension.d.ts.map