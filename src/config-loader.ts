/**
 * Configuration loader with automatic parsing from ENV, CLI args, and files
 * 
 * Uses TypeBox schema to safely transform and filter configuration
 * without throwing validation errors (uses Value.Cast for safe transformation)
 */

import { readFile } from 'fs/promises';
import { resolve, join } from 'path';
import { type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { parseCliArgs as parseCliArgsBase } from './cli-parser.js';

export interface ConfigLoaderOptions {
  /** TypeBox schema for configuration (used for transformation/filtering) */
  schema?: TSchema;
  /** Default config file path (e.g., '.cursor-stock-images.json') */
  configFile?: string;
}

/**
 * Parse CLI arguments into config object using yargs
 * Supports --key value, --key=value, and boolean flags
 */
function parseCliArgs(): Record<string, unknown> {
  // Parse with minimist - automatically parses ALL options into object
  // minimist already converts kebab-case to camelCase via parseCliArgsBase()
  // TypeBox schema in loadConfig() will filter unknown options via Value.Cast
  const parsed = parseCliArgsBase();
  
  // Extract config file path if present (remove from result)
  const { config: _config, configFile: _configFile, ...rest } = parsed;
  
  // parseCliArgsBase() already returns camelCase keys, just return rest
  return rest;
}

/**
 * Parse string value to appropriate type
 */
function parseValue(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // Try to parse as number
  const trimmed = value.trim();
  if (trimmed === '') return value;
  
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
function loadFromEnv(schema?: TSchema): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  
  // If schema provided, extract keys from schema
  if (schema) {
    const schemaKeys = extractSchemaKeys(schema);
    
    // Only process env vars that match schema keys
    for (const [envKey, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      
      const configKey = envToConfigKey(envKey);
      if (schemaKeys.has(configKey)) {
        config[configKey] = parseValue(value);
      }
    }
  } else {
    // No schema - process all env vars (convert to camelCase)
    for (const [envKey, value] of Object.entries(process.env)) {
      // Skip MCP_* vars (handled by SDK)
      if (envKey.startsWith('MCP_')) continue;
      // Skip SECRET_* vars (handled by SDK as secrets, not config)
      if (envKey.startsWith('SECRET_')) continue;
      if (value === undefined) continue;
      
      const configKey = envToConfigKey(envKey);
      config[configKey] = parseValue(value);
    }
  }
  
  return config;
}

/**
 * Convert ENV_VAR_NAME to camelCase config key
 */
function envToConfigKey(envKey: string): string {
  return envKey
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Extract keys from TypeBox schema (recursive)
 * TypeBox schemas have a special structure with [Symbol.for('TypeBox.Kind')]
 */
function extractSchemaKeys(schema: TSchema): Set<string> {
  const keys = new Set<string>();
  
  if (!schema || typeof schema !== 'object') {
    return keys;
  }
  
  // Type.Object - has properties
  if ('properties' in schema && typeof schema.properties === 'object') {
    Object.keys(schema.properties).forEach(key => keys.add(key));
    
    // Also check nested objects recursively
    Object.values(schema.properties).forEach((prop: any) => {
      if (prop && typeof prop === 'object' && 'properties' in prop) {
        extractSchemaKeys(prop).forEach(key => keys.add(key));
      }
    });
  }
  
  // Type.Union (anyOf)
  if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
    schema.anyOf.forEach((s: TSchema) => {
      extractSchemaKeys(s).forEach(key => keys.add(key));
    });
  }
  
  // Type.Intersect (allOf)
  if ('allOf' in schema && Array.isArray(schema.allOf)) {
    schema.allOf.forEach((s: TSchema) => {
      extractSchemaKeys(s).forEach(key => keys.add(key));
    });
  }
  
  return keys;
}

/**
 * Get config file path from CLI arguments using yargs
 */
function getConfigFileFromArgs(): string | undefined {
  const parsed = parseCliArgsBase();
  const configPath = parsed.config as string | undefined || parsed.configFile as string | undefined;
  return configPath ? resolve(configPath) : undefined;
}

/**
 * Load configuration from JSON file
 */
async function loadFromFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error: any) {
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
export async function loadConfig(
  options: ConfigLoaderOptions = {}
): Promise<Record<string, unknown>> {
  const { schema, configFile: defaultConfigFile } = options;
  
  // 1. Get config file path (CLI > default)
  const configFilePath = getConfigFileFromArgs() || 
    (defaultConfigFile ? join(process.cwd(), defaultConfigFile) : undefined);
  
  // 2. Load from file (if exists)
  let fileConfig: Record<string, unknown> = {};
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
    return Value.Cast(schema, rawConfig) as Record<string, unknown>;
  }
  
  return rawConfig;
}

