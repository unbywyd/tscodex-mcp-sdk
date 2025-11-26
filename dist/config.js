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
import { Value } from '@sinclair/typebox/value';
/**
 * Format TypeBox validation errors into readable message
 */
function formatValidationErrors(errors) {
    if (errors.length === 0) {
        return 'Validation failed';
    }
    const messages = errors.map(error => {
        const path = error.path || 'root';
        const message = error.message || 'Invalid value';
        return `${path} ${message}`;
    });
    return messages.join('; ');
}
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
export function validateConfig(config, schema) {
    // If schema is not provided, just return the config
    if (!schema) {
        return config;
    }
    // TypeBox validation
    const errors = [...Value.Errors(schema, config)];
    if (errors.length > 0) {
        const errorMessages = errors.map(err => ({
            path: err.path || 'root',
            message: err.message || 'Invalid value',
            value: err.value
        }));
        const errorMessage = formatValidationErrors(errorMessages);
        throw new Error(`Configuration validation failed: ${errorMessage}`);
    }
    // TypeBox applies default values automatically via Value.Cast
    return Value.Cast(schema, config);
}
/**
 * Deep merge two objects recursively
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            const sourceValue = source[key];
            const targetValue = result[key];
            if (sourceValue === undefined) {
                continue;
            }
            if (sourceValue === null) {
                result[key] = null;
            }
            else if (Array.isArray(sourceValue)) {
                // For arrays, replace entirely (don't merge)
                result[key] = [...sourceValue];
            }
            else if (typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
                // For objects, merge recursively
                if (typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)) {
                    result[key] = deepMerge(targetValue, sourceValue);
                }
                else {
                    result[key] = { ...sourceValue };
                }
            }
            else {
                // For primitives, replace
                result[key] = sourceValue;
            }
        }
    }
    return result;
}
/**
 * Internal utility: Merge configuration (used during initialization only)
 *
 * IMPORTANT: This is an internal function for merging configs during initialization.
 * SDK does NOT provide a public updateConfig() method - Extension configuration
 * is updated only by restarting the process with new process.env.MCP_CONFIG.
 */
export function updateConfig(current, updates, schema) {
    const merged = deepMerge(current, updates);
    if (schema) {
        return validateConfig(merged, schema);
    }
    return merged;
}
//# sourceMappingURL=config.js.map