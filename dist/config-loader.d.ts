/**
 * Configuration loader with automatic parsing from ENV, CLI args, and files
 *
 * Uses TypeBox schema to safely transform and filter configuration
 * without throwing validation errors (uses Value.Cast for safe transformation)
 */
import { type TSchema } from '@sinclair/typebox';
export interface ConfigLoaderOptions {
    /** TypeBox schema for configuration (used for transformation/filtering) */
    schema?: TSchema;
    /** Default config file path (e.g., '.cursor-stock-images.json') */
    configFile?: string;
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
export declare function loadConfig(options?: ConfigLoaderOptions): Promise<Record<string, unknown>>;
//# sourceMappingURL=config-loader.d.ts.map