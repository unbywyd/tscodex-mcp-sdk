/**
 * CLI arguments parser using minimist
 * Provides unified parsing for both server settings and application config
 *
 * minimist is lightweight (~2KB) and reliable, used by npm, webpack, and many other tools
 */
/**
 * Parse CLI arguments using minimist
 * Automatically parses all options without requiring explicit definition
 *
 * @returns Parsed arguments object with camelCase keys
 */
export declare function parseCliArgs(): Record<string, unknown>;
/**
 * Parse CLI arguments for server settings (host, port, mcpPath, projectRoot)
 * Returns only server-related arguments
 */
/**
 * Parse CLI arguments for server settings (host, port, mcpPath, projectRoot)
 * Returns only server-related arguments
 */
export declare function parseServerCliArgs(): {
    host?: string;
    port?: string | number;
    mcpPath?: string;
    projectRoot?: string;
};
//# sourceMappingURL=cli-parser.d.ts.map