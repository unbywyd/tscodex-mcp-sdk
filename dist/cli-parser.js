/**
 * CLI arguments parser using minimist
 * Provides unified parsing for both server settings and application config
 *
 * minimist is lightweight (~2KB) and reliable, used by npm, webpack, and many other tools
 */
import minimist from 'minimist';
/**
 * Convert kebab-case to camelCase
 * More reliable: handles any case after dash, multiple dashes, edge cases
 */
function kebabToCamel(str) {
    if (!str || typeof str !== 'string')
        return str;
    return str
        .replace(/^-+/, '') // Remove leading dashes
        .replace(/-+$/, '') // Remove trailing dashes
        .replace(/-+([a-zA-Z0-9])/g, (_, char) => char.toUpperCase()) // Convert dash+char to uppercase
        .replace(/^([A-Z])/, (_, char) => char.toLowerCase()); // Ensure first char is lowercase
}
/**
 * Parse CLI arguments using minimist
 * Automatically parses all options without requiring explicit definition
 *
 * @returns Parsed arguments object with camelCase keys
 */
export function parseCliArgs() {
    try {
        const parsed = minimist(process.argv.slice(2), {
            boolean: true, // Treat --flag as boolean
            string: [], // Treat all as strings by default (can be overridden)
            alias: {},
            default: {},
            '--': false, // Don't stop parsing at --
        });
        const result = {};
        // Convert all keys to camelCase and add to result
        for (const [key, value] of Object.entries(parsed)) {
            if (key === '_')
                continue; // Skip positional arguments
            const camelKey = kebabToCamel(key);
            result[camelKey] = value;
        }
        return result;
    }
    catch (error) {
        // If minimist fails, return empty object
        return {};
    }
}
/**
 * Parse CLI arguments for server settings (host, port, mcpPath, projectRoot)
 * Returns only server-related arguments
 */
/**
 * Parse CLI arguments for server settings (host, port, mcpPath, projectRoot)
 * Returns only server-related arguments
 */
export function parseServerCliArgs() {
    const parsed = parseCliArgs();
    return {
        host: parsed.host,
        port: parsed.port,
        mcpPath: parsed.mcpPath, // minimist + kebabToCamel конвертирует --mcp-path в mcpPath
        projectRoot: parsed.projectRoot, // --project-root -> projectRoot
    };
}
//# sourceMappingURL=cli-parser.js.map