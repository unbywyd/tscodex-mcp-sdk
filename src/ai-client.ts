/**
 * AI Client for MCP servers
 *
 * Provides a simple interface to interact with the AI proxy provided by MCP Manager.
 *
 * ## How it works
 *
 * When MCP Manager starts your server, it automatically injects two environment variables:
 * - `MCP_AI_PROXY_URL` - The URL of the AI proxy endpoint (e.g., `http://127.0.0.1:4040/api/ai/proxy/v1`)
 * - `MCP_AI_PROXY_TOKEN` - A unique token for your server to authenticate with the proxy
 *
 * The proxy acts as a secure intermediary between your MCP server and the actual AI provider
 * (OpenAI, OpenRouter, Ollama, etc.). This design provides several benefits:
 *
 * 1. **Security** - Your server never sees the real API key
 * 2. **Rate limiting** - MCP Manager can limit requests per server
 * 3. **Model restrictions** - Admins can control which models each server can use
 * 4. **Usage tracking** - All requests are logged for monitoring
 * 5. **Centralized config** - One API key configuration for all servers
 *
 * ## Token lifecycle
 *
 * - A new token is generated each time your server starts
 * - Tokens are stored in memory and invalidated on server restart
 * - If the token becomes invalid, requests will fail with 401 Unauthorized
 *
 * ## Basic usage
 *
 * @example
 * ```typescript
 * import { getAIClient } from '@tscodex/mcp-sdk';
 *
 * const ai = getAIClient();
 *
 * // Always check availability before using AI
 * if (await ai.isAvailable()) {
 *   // Simple completion
 *   const result = await ai.complete('Summarize this text...');
 *
 *   // Or full chat API
 *   const response = await ai.chat({
 *     messages: [{ role: 'user', content: 'Hello!' }],
 *     temperature: 0.7,
 *   });
 * }
 * ```
 *
 * ## Error handling
 *
 * @example
 * ```typescript
 * import { getAIClient, AIClientError } from '@tscodex/mcp-sdk';
 *
 * const ai = getAIClient();
 *
 * try {
 *   const result = await ai.complete('Hello');
 * } catch (error) {
 *   if (error instanceof AIClientError) {
 *     switch (error.code) {
 *       case 'NOT_CONFIGURED':
 *         // AI proxy URL or token not set
 *         break;
 *       case 'UNAUTHORIZED':
 *         // Token invalid or expired (server restarted?)
 *         break;
 *       case 'RATE_LIMITED':
 *         // Too many requests, try again later
 *         break;
 *       case 'API_ERROR':
 *         // Upstream API error
 *         break;
 *       case 'TIMEOUT':
 *         // Request timed out
 *         break;
 *       case 'NETWORK_ERROR':
 *         // Network connectivity issue
 *         break;
 *     }
 *   }
 * }
 * ```
 *
 * ## Using with tools
 *
 * @example
 * ```typescript
 * import { McpServer, Type, getAIClient } from '@tscodex/mcp-sdk';
 *
 * const server = new McpServer({ name: 'my-server' });
 * const ai = getAIClient();
 *
 * server.addTool({
 *   name: 'summarize',
 *   description: 'Summarize text using AI',
 *   schema: Type.Object({
 *     text: Type.String({ description: 'Text to summarize' }),
 *   }),
 *   handler: async ({ text }) => {
 *     // Graceful degradation when AI is not available
 *     if (!await ai.isAvailable()) {
 *       return {
 *         content: [{ type: 'text', text: 'AI summarization is not available' }],
 *         isError: true,
 *       };
 *     }
 *
 *     const summary = await ai.completeWithSystem(
 *       'You are a helpful assistant that creates concise summaries.',
 *       `Please summarize the following text:\n\n${text}`
 *     );
 *
 *     return {
 *       content: [{ type: 'text', text: summary }],
 *     };
 *   },
 * });
 * ```
 *
 * ## Custom configuration
 *
 * @example
 * ```typescript
 * import { createAIClient } from '@tscodex/mcp-sdk';
 *
 * // Create client with custom options
 * const ai = createAIClient({
 *   defaultModel: 'gpt-4',      // Default model for all requests
 *   timeout: 60000,              // 60 second timeout
 *   // baseUrl and token are still read from env by default
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/** Options for creating an AI client */
export interface AIClientOptions {
  /** Override proxy URL (default: from MCP_AI_PROXY_URL env) */
  baseUrl?: string;
  /** Override token (default: from MCP_AI_PROXY_TOKEN env) */
  token?: string;
  /** Default model to use if not specified in requests */
  defaultModel?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

/** Chat message */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Options for chat completion */
export interface ChatCompletionOptions {
  /** Model to use (optional, falls back to defaultModel or proxy default) */
  model?: string;
  /** Messages to send */
  messages: ChatMessage[];
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Stop sequences */
  stop?: string | string[];
  /** Presence penalty (-2 to 2) */
  presence_penalty?: number;
  /** Frequency penalty (-2 to 2) */
  frequency_penalty?: number;
  /** Top-p sampling */
  top_p?: number;
}

/** Single choice in chat completion response */
export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

/** Usage information */
export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Chat completion response (OpenAI-compatible) */
export interface ChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

/** Model information */
export interface ModelInfo {
  id: string;
  object: 'model';
  created?: number;
  owned_by?: string;
}

/** Response from /models endpoint (OpenAI-compatible with MCP Manager extensions) */
export interface ModelsResponse {
  object: 'list';
  data: ModelInfo[];
  /** Default model configured in MCP Manager */
  default_model: string;
  /** Rate limit for this token (requests per minute, 0 = unlimited) */
  rate_limit?: number;
}

/** Error codes */
export type AIClientErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

// ============================================================================
// Error Class
// ============================================================================

/**
 * Error thrown by AI client operations
 */
export class AIClientError extends Error {
  constructor(
    message: string,
    public readonly code: AIClientErrorCode,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'AIClientError';
  }
}

// ============================================================================
// AI Client
// ============================================================================

/**
 * AI Client for interacting with the MCP Manager AI proxy
 */
export class AIClient {
  private baseUrl: string;
  private token: string;
  private defaultModel: string;
  private timeout: number;
  private _availabilityChecked: boolean = false;
  private _available: boolean = false;

  constructor(options: AIClientOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.MCP_AI_PROXY_URL || '';
    this.token = options.token || process.env.MCP_AI_PROXY_TOKEN || '';
    this.defaultModel = options.defaultModel || '';
    this.timeout = options.timeout || 30000;
  }

  /**
   * Check if AI client is configured (has URL and token)
   * This is a synchronous check - does not verify connectivity
   */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.token);
  }

  /**
   * Check if AI proxy is available and responding
   * Makes a request to verify connectivity (cached after first call)
   *
   * @param forceCheck - Force re-check even if already cached
   */
  async isAvailable(forceCheck: boolean = false): Promise<boolean> {
    if (this._availabilityChecked && !forceCheck) {
      return this._available;
    }

    if (!this.isConfigured()) {
      this._availabilityChecked = true;
      this._available = false;
      return false;
    }

    try {
      const response = await this.getModels();
      this._available = Array.isArray(response.data) && response.data.length > 0;
    } catch {
      this._available = false;
    }

    this._availabilityChecked = true;
    return this._available;
  }

  /**
   * Reset availability cache (useful after config changes)
   */
  resetAvailabilityCache(): void {
    this._availabilityChecked = false;
    this._available = false;
  }

  /**
   * Get available models from the proxy
   * @throws {AIClientError} If not configured or request fails
   */
  async getModels(): Promise<ModelsResponse> {
    this.ensureConfigured();
    return this.request<ModelsResponse>('/models');
  }

  /**
   * Get the default model configured in MCP Manager
   * Fetches from proxy if not cached locally
   *
   * @returns The default model ID, or null if not available
   */
  async getDefaultModel(): Promise<string | null> {
    // Return local override if set
    if (this.defaultModel) {
      return this.defaultModel;
    }

    try {
      const models = await this.getModels();
      return models.default_model || null;
    } catch {
      return null;
    }
  }

  /**
   * Create a chat completion
   * @throws {AIClientError} If not configured or request fails
   */
  async chat(options: ChatCompletionOptions): Promise<ChatCompletion> {
    this.ensureConfigured();

    const body = {
      ...options,
      model: options.model || this.defaultModel || undefined,
    };

    return this.request<ChatCompletion>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Simple helper for single-prompt completions
   *
   * @param prompt - The prompt to complete
   * @param options - Optional chat completion options (without messages)
   * @returns The generated text content
   * @throws {AIClientError} If not configured or request fails
   *
   * @example
   * ```typescript
   * const summary = await ai.complete('Summarize: ' + longText);
   * ```
   */
  async complete(
    prompt: string,
    options?: Omit<ChatCompletionOptions, 'messages'>
  ): Promise<string> {
    const response = await this.chat({
      ...options,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Helper for system + user prompt pattern
   *
   * @param systemPrompt - System instructions
   * @param userPrompt - User message
   * @param options - Optional chat completion options (without messages)
   * @returns The generated text content
   *
   * @example
   * ```typescript
   * const result = await ai.completeWithSystem(
   *   'You are a helpful assistant that summarizes text.',
   *   'Please summarize: ' + text
   * );
   * ```
   */
  async completeWithSystem(
    systemPrompt: string,
    userPrompt: string,
    options?: Omit<ChatCompletionOptions, 'messages'>
  ): Promise<string> {
    const response = await this.chat({
      ...options,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    return response.choices[0]?.message?.content || '';
  }

  // ==========================================================================
  // Private methods
  // ==========================================================================

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new AIClientError(
        'AI client not configured. Ensure MCP_AI_PROXY_URL and MCP_AI_PROXY_TOKEN are set.',
        'NOT_CONFIGURED'
      );
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...init?.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as { error?: string };
        const message = errorBody.error || `HTTP ${response.status}`;

        let code: AIClientErrorCode = 'API_ERROR';
        if (response.status === 401) code = 'UNAUTHORIZED';
        else if (response.status === 429) code = 'RATE_LIMITED';

        throw new AIClientError(message, code, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AIClientError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AIClientError(
            `Request timed out after ${this.timeout}ms`,
            'TIMEOUT'
          );
        }

        throw new AIClientError(error.message, 'NETWORK_ERROR');
      }

      throw new AIClientError('Unknown error', 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let defaultClient: AIClient | null = null;

/**
 * Get the default AI client singleton
 * Uses environment variables for configuration
 *
 * @example
 * ```typescript
 * import { getAIClient } from '@tscodex/mcp-sdk';
 *
 * const ai = getAIClient();
 * if (await ai.isAvailable()) {
 *   const result = await ai.complete('Hello!');
 * }
 * ```
 */
export function getAIClient(): AIClient {
  if (!defaultClient) {
    defaultClient = new AIClient();
  }
  return defaultClient;
}

/**
 * Create a new AI client with custom options
 * Use this if you need different configuration than the default
 *
 * @example
 * ```typescript
 * import { createAIClient } from '@tscodex/mcp-sdk';
 *
 * const ai = createAIClient({
 *   defaultModel: 'gpt-4',
 *   timeout: 60000,
 * });
 * ```
 */
export function createAIClient(options: AIClientOptions): AIClient {
  return new AIClient(options);
}
