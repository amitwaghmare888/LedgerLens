/**
 * LedgerLens AI Provider Factory
 *
 * Server-side only. Creates provider instances based on configuration.
 * API keys must come from environment variables, never from client code.
 */
import type { AIProvider, AIProviderConfig } from './provider-interface';
import { OmniRouteProvider } from './providers/omniroute';
import { GeminiProvider } from './providers/gemini';
import { GroqProvider } from './providers/groq';

/**
 * Loads AI provider configuration from environment variables.
 * Returns null if no provider is configured.
 *
 * Environment variables checked:
 * - AI_PROVIDER: 'omniroute' | 'gemini' | 'groq'
 * - AI_MODEL: model name
 * - AI_API_KEY: API key for the provider
 * - AI_BASE_URL: (optional) custom base URL
 */
export function loadProviderConfig(): AIProviderConfig | null {
  const provider = process.env.AI_PROVIDER as AIProviderConfig['provider'] | undefined;
  const model = process.env.AI_MODEL;
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;

  if (!provider || !model || !apiKey) {
    return null;
  }

  if (provider !== 'omniroute' && provider !== 'gemini' && provider !== 'groq') {
    console.warn(`[AI] Unknown provider: ${provider}. AI investigations unavailable.`);
    return null;
  }

  return { provider, model, apiKey, baseUrl };
}

/**
 * Creates an AI provider instance from configuration.
 * Throws if config is invalid.
 */
export function createProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'omniroute':
      return new OmniRouteProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'groq':
      return new GroqProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Gets the configured AI provider instance, or null if not configured.
 * This is the primary entry point for server-side code.
 */
export function getAIProvider(): AIProvider | null {
  const config = loadProviderConfig();
  if (!config) return null;
  return createProvider(config);
}
