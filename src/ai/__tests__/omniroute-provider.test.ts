/**
 * Tests for OmniRoute Provider
 *
 * Verifies request format and response handling.
 * NO real API keys. NO external network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OmniRouteProvider } from '../providers/omniroute';
import type { AIInvestigationRequest } from '../provider-interface';

// Mock fetch globally
global.fetch = vi.fn();

describe('OmniRoute Provider - Request Format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends stream: false in request body to disable streaming', async () => {
    const provider = new OmniRouteProvider({
      provider: 'omniroute',
      model: 'test-model',
      apiKey: 'test-key',
      baseUrl: 'http://localhost:20128/v1',
    });

    const mockRequest: AIInvestigationRequest = {
      exceptionId: 'test-exc',
      exceptionType: 'TEST',
      exceptionDescription: 'Test exception',
      evidence: {
        exceptionAmount: 100000,
        linkedRecords: [],
        deterministicFindings: [],
      },
      candidateRecordIds: [],
    };

    // Mock successful non-streaming response
    const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                conclusion: 'inconclusive',
                summary: 'Test summary with sufficient length',
                candidateRecordIds: [],
                evidence: [],
                discrepancies: [],
                recommendedAction: 'Manual review required',
              }),
            },
          },
        ],
        usage: { total_tokens: 100 },
      }),
    });

    await provider.investigate(mockRequest);

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Verify the request body includes stream: false
    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(fetchCall[1].body as string);

    expect(requestBody.stream).toBe(false);
    expect(requestBody.model).toBe('test-model');
    expect(requestBody.messages).toHaveLength(2);
    expect(requestBody.temperature).toBe(0.1);
    expect(requestBody.max_tokens).toBe(2000);
  });

  it('parses non-streaming JSON response correctly', async () => {
    const provider = new OmniRouteProvider({
      provider: 'omniroute',
      model: 'test-model',
      apiKey: 'test-key',
      baseUrl: 'http://localhost:20128/v1',
    });

    const mockRequest: AIInvestigationRequest = {
      exceptionId: 'test-exc',
      exceptionType: 'TEST',
      exceptionDescription: 'Test exception',
      evidence: {
        exceptionAmount: 100000,
        linkedRecords: [],
        deterministicFindings: [],
      },
      candidateRecordIds: [],
    };

    const mockOutput = {
      conclusion: 'supported' as const,
      summary: 'Test summary',
      candidateRecordIds: ['rec_123'],
      evidence: ['Evidence 1'],
      discrepancies: [],
      recommendedAction: 'Test action',
    };

    const mockFetch2 = global.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch2.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(mockOutput),
            },
          },
        ],
        usage: { total_tokens: 150 },
      }),
    });

    const result = await provider.investigate(mockRequest);

    expect(result.provider).toBe('omniroute');
    expect(result.model).toBe('test-model');
    expect(result.output.conclusion).toBe('supported');
    expect(result.tokensUsed).toBe(150);
  });
});
