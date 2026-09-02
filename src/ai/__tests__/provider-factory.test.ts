/**
 * Tests for Provider Factory
 *
 * Ensures provider configuration is safe and correct.
 * NO real API keys. NO external network.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadProviderConfig, createProvider } from '../provider-factory';
import type { AIProviderConfig } from '../provider-interface';

describe('Provider Factory', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear env vars
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
  });

  afterEach(() => {
    // Restore env vars
    process.env = { ...originalEnv };
  });

  it('returns null when no provider configured', () => {
    const config = loadProviderConfig();
    expect(config).toBeNull();
  });

  it('returns null when provider is set but model is missing', () => {
    process.env.AI_PROVIDER = 'omniroute';
    process.env.AI_API_KEY = 'test-key';
    // AI_MODEL is missing

    const config = loadProviderConfig();
    expect(config).toBeNull();
  });

  it('returns null when provider is set but API key is missing', () => {
    process.env.AI_PROVIDER = 'omniroute';
    process.env.AI_MODEL = 'test-model';
    // AI_API_KEY is missing

    const config = loadProviderConfig();
    expect(config).toBeNull();
  });

  it('loads valid OmniRoute configuration', () => {
    process.env.AI_PROVIDER = 'omniroute';
    process.env.AI_MODEL = 'test-model';
    process.env.AI_API_KEY = 'test-key';

    const config = loadProviderConfig();
    expect(config).not.toBeNull();
    expect(config?.provider).toBe('omniroute');
    expect(config?.model).toBe('test-model');
    expect(config?.apiKey).toBe('test-key');
  });

  it('loads valid Gemini configuration', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.AI_MODEL = 'gemini-pro';
    process.env.AI_API_KEY = 'test-key';

    const config = loadProviderConfig();
    expect(config).not.toBeNull();
    expect(config?.provider).toBe('gemini');
  });

  it('loads valid Groq configuration', () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.AI_MODEL = 'llama-3-70b';
    process.env.AI_API_KEY = 'test-key';

    const config = loadProviderConfig();
    expect(config).not.toBeNull();
    expect(config?.provider).toBe('groq');
  });

  it('includes custom base URL when provided', () => {
    process.env.AI_PROVIDER = 'omniroute';
    process.env.AI_MODEL = 'test-model';
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_BASE_URL = 'https://custom.api.com/v1';

    const config = loadProviderConfig();
    expect(config?.baseUrl).toBe('https://custom.api.com/v1');
  });

  it('returns null for unknown provider', () => {
    process.env.AI_PROVIDER = 'unknown-provider';
    process.env.AI_MODEL = 'test-model';
    process.env.AI_API_KEY = 'test-key';

    const config = loadProviderConfig();
    expect(config).toBeNull();
  });

  it('creates OmniRoute provider from config', () => {
    const config: AIProviderConfig = {
      provider: 'omniroute',
      model: 'test-model',
      apiKey: 'test-key',
    };

    const provider = createProvider(config);
    expect(provider).toBeDefined();
  });

  it('creates Gemini provider from config', () => {
    const config: AIProviderConfig = {
      provider: 'gemini',
      model: 'gemini-pro',
      apiKey: 'test-key',
    };

    const provider = createProvider(config);
    expect(provider).toBeDefined();
  });

  it('creates Groq provider from config', () => {
    const config: AIProviderConfig = {
      provider: 'groq',
      model: 'llama-3-70b',
      apiKey: 'test-key',
    };

    const provider = createProvider(config);
    expect(provider).toBeDefined();
  });

  it('throws on invalid provider in createProvider', () => {
    const config: AIProviderConfig = {
      provider: 'invalid' as AIProviderConfig['provider'],
      model: 'test',
      apiKey: 'test',
    };

    expect(() => createProvider(config)).toThrow();
  });
});
