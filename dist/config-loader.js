/**
 * Configuration loader with automatic parsing from ENV, CLI args, and files
 *
 * Uses TypeBox schema to safely transform and filter configuration
 * without throwing validation errors (uses Value.Cast for safe transformation)
 */
import { readFile } from 'fs/promises';
import { resolve, join } from 'path';
import { Value } from '@sinclair/typebox/value';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
/**
 * Parse CLI arguments into config object using yargs
 * Supports --key value, --key=value, and boolean flags
 */
function parseCliArgs() {
    try {
        // Parse with yargs - allows unknown options and doesn't exit
        const parsed = yargs(hideBin(process.argv))
            .parserConfiguration({
            'parse-positional-numbers': false,
            'strip-aliased': false,
            'strip-dashed': false,
            'unknown-options-as-args': true
        })
            .help(false)
            .version(false)
            .strict(false)
            .parseSync();
        // Extract config file path if present (remove from result)
        const { config: _config, configFile: _configFile, ...rest } = parsed;
        // Convert yargs result to config object
        // yargs already handles camelCase conversion for --kebab-case
        const config = {};
        for (const [key, value] of Object.entries(rest)) {
            // Skip yargs internal properties
            if (key.startsWith('$0') || key === '_')
                continue;
            // Normalize key (yargs may have already done some conversion)
            const normalizedKey = normalizeKey(key);
            config[normalizedKey] = value;
        }
        return config;
    }
    catch (error) {
        // If yargs fails, fall back to empty config
        return {};
    }
}
/**
 * Normalize key from CLI (kebab-case to camelCase)
 */
function normalizeKey(key) {
    return key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
/**
 * Parse string value to appropriate type
 */
function parseValue(value) {
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    // Try to parse as number
    const trimmed = value.trim();
    if (trimmed === '')
        return value;
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num) && trimmed !== '') {
        return num;
    }
    return value;
}
/**
 * Load configuration from environment variables
 * Converts ENV_VAR_NAME to camelCase config key
 */
function loadFromEnv(schema) {
    const config = {};
    // If schema provided, extract keys from schema
    if (schema) {
        const schemaKeys = extractSchemaKeys(schema);
        // Only process env vars that match schema keys
        for (const [envKey, value] of Object.entries(process.env)) {
            if (value === undefined)
                continue;
            const configKey = envToConfigKey(envKey);
            if (schemaKeys.has(configKey)) {
                config[configKey] = parseValue(value);
            }
        }
    }
    else {
        // No schema - process all env vars (convert to camelCase)
        for (const [envKey, value] of Object.entries(process.env)) {
            // Skip MCP_* vars (handled by SDK)
            if (envKey.startsWith('MCP_'))
                continue;
            // Skip SECRET_* vars (handled by SDK as secrets, not config)
            if (envKey.startsWith('SECRET_'))
                continue;
            if (value === undefined)
                continue;
            const configKey = envToConfigKey(envKey);
            config[configKey] = parseValue(value);
        }
    }
    return config;
}
/**
 * Convert ENV_VAR_NAME to camelCase config key
 */
function envToConfigKey(envKey) {
    return envKey
        .toLowerCase()
        .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
/**
 * Extract keys from TypeBox schema (recursive)
 * TypeBox schemas have a special structure with [Symbol.for('TypeBox.Kind')]
 */
function extractSchemaKeys(schema) {
    const keys = new Set();
    if (!schema || typeof schema !== 'object') {
        return keys;
    }
    // Type.Object - has properties
    if ('properties' in schema && typeof schema.properties === 'object') {
        Object.keys(schema.properties).forEach(key => keys.add(key));
        // Also check nested objects recursively
        Object.values(schema.properties).forEach((prop) => {
            if (prop && typeof prop === 'object' && 'properties' in prop) {
                extractSchemaKeys(prop).forEach(key => keys.add(key));
            }
        });
    }
    // Type.Union (anyOf)
    if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
        schema.anyOf.forEach((s) => {
            extractSchemaKeys(s).forEach(key => keys.add(key));
        });
    }
    // Type.Intersect (allOf)
    if ('allOf' in schema && Array.isArray(schema.allOf)) {
        schema.allOf.forEach((s) => {
            extractSchemaKeys(s).forEach(key => keys.add(key));
        });
    }
    return keys;
}
/**
 * Get config file path from CLI arguments using yargs
 */
function getConfigFileFromArgs() {
    try {
        const parsed = yargs(hideBin(process.argv))
            .option('config', {
            alias: 'config-file',
            type: 'string',
            describe: 'Path to config file'
        })
            .help(false)
            .version(false)
            .strict(false)
            .parseSync();
        const configPath = parsed.config;
        return configPath ? resolve(configPath) : undefined;
    }
    catch {
        return undefined;
    }
}
/**
 * Load configuration from JSON file
 */
async function loadFromFile(filePath) {
    try {
        const content = await readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            // File not found - return empty
            return {};
        }
        throw new Error(`Failed to load config file ${filePath}: ${error.message}`);
    }
}
/**
 * Load and parse configuration from multiple sources
 *
 * Priority: CLI > ENV > File > Defaults
 *
 * Uses TypeBox schema to safely transform and filter configuration
 * without throwing validation errors (uses Value.Cast)
 *
 * @param options - Configuration loader options
 * @returns Parsed configuration object
 */
export async function loadConfig(options = {}) {
    const { schema, configFile: defaultConfigFile } = options;
    // 1. Get config file path (CLI > default)
    const configFilePath = getConfigFileFromArgs() ||
        (defaultConfigFile ? join(process.cwd(), defaultConfigFile) : undefined);
    // 2. Load from file (if exists)
    let fileConfig = {};
    if (configFilePath) {
        fileConfig = await loadFromFile(configFilePath);
    }
    // 3. Load from environment variables
    const envConfig = loadFromEnv(schema);
    // 4. Parse CLI arguments
    const cliConfig = parseCliArgs();
    // 5. Merge: CLI > ENV > File
    const rawConfig = {
        ...fileConfig,
        ...envConfig,
        ...cliConfig
    };
    // 6. Apply schema transformation (safe, no validation errors)
    // Value.Cast applies defaults and transforms types, but doesn't throw on invalid values
    if (schema) {
        return Value.Cast(schema, rawConfig);
    }
    return rawConfig;
}
//# sourceMappingURL=config-loader.js.map