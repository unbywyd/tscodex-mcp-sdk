/**
 * Configuration management with TypeBox validation
 *
 * We use TypeBox for validation and typing of configuration.
 *
 * TypeBox provides:
 * - Automatic TypeScript type inference from schema
 * - Runtime validation with detailed error messages
 * - Support for formats (email, uri, date-time, uuid, etc.)
 * - Application of default values from schema
 * - JSON Schema generation for MCP protocol compatibility
 */
import { type TSchema } from '@sinclair/typebox';
/**
 * Validate configuration against TypeBox schema
 *
 * @param config - Configuration object to validate
 * @param schema - TypeBox schema to validate against
 * @returns Validated configuration (with defaults applied automatically)
 * @throws {Error} If validation fails with detailed error message
 *
 * @example
 * ```typescript
 * import { Type } from '@sinclair/typebox';
 *
 * const schema = Type.Object({
 *   apiKey: Type.String({ minLength: 10 }),
 *   timeout: Type.Number({ minimum: 1000, maximum: 60000, default: 5000 })
 * });
 *
 * const config = validateConfig({ apiKey: '123' }, schema);
 * // Throws: "/apiKey Expected string length >= 10"
 * ```
 */
export declare function validateConfig<TConfig>(config: unknown, schema?: TSchema): TConfig;
/**
 * Internal utility: Merge configuration (used during initialization only)
 *
 * IMPORTANT: This is an internal function for merging configs during initialization.
 * SDK does NOT provide a public updateConfig() method - Extension configuration
 * is updated only by restarting the process with new process.env.MCP_CONFIG.
 */
export declare function updateConfig<TConfig>(current: TConfig, updates: Partial<TConfig>, schema?: TSchema): TConfig;
//# sourceMappingURL=config.d.ts.map