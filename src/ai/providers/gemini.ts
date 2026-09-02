/**
 * Gemini AI Provider Adapter
 *
 * Server-side only. Uses HTTP to communicate with Google Gemini API.
 * Never expose API keys to client code.
 */
import type {
  AIProvider,
  AIProviderConfig,
  AIInvestigationRequest,
  AIInvestigationResponse,
} from '../provider-interface';
import { AIProviderException } from '../provider-interface';
import { buildInvestigationPrompt } from '../prompt-builder';
import { parseAIResponse } from '../response-parser';

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    if (config.provider !== 'gemini') {
      throw new Error('Invalid provider config for Gemini');
    }
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  async investigate(request: AIInvestigationRequest): Promise<AIInvestigationResponse> {
    const prompt = buildInvestigationPrompt(request);
    const systemPrompt = this.getSystemPrompt();
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    try {
      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: fullPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2000,
            },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new AIProviderException('INVALID_API_KEY', 'Gemini API key is invalid');
        }
        if (response.status === 429) {
          throw new AIProviderException('RATE_LIMIT', 'Gemini rate limit exceeded');
        }
        throw new AIProviderException(
          'PROVIDER_ERROR',
          `Gemini API error: ${response.status}`,
          { status: response.status }
        );
      }

      const data = await response.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new AIProviderException('MALFORMED_RESPONSE', 'Gemini response missing content');
      }

      const content = data.candidates[0].content.parts[0].text;
      const output = parseAIResponse(content);

      return {
        provider: 'gemini',
        model: this.model,
        output,
        tokensUsed: data.usageMetadata?.totalTokenCount,
        rawResponse: content,
      };
    } catch (err) {
      if (err instanceof AIProviderException) throw err;
      if ((err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') {
        throw new AIProviderException('TIMEOUT', 'Gemini request timed out');
      }
      throw new AIProviderException('PROVIDER_UNAVAILABLE', 'Failed to reach Gemini', err);
    }
  }

  private getSystemPrompt(): string {
    return `You are a financial reconciliation analyst for LedgerLens.
Your task is to investigate unresolved exceptions by analyzing observable evidence.

CRITICAL RULES:
1. You may ONLY reference record IDs provided in the candidate list
2. You may ONLY cite evidence items provided in the evidence packet
3. You must NEVER fabricate amounts, dates, identifiers, or relationships
4. If evidence is insufficient, return "inconclusive" - DO NOT GUESS
5. Your output will be deterministically verified against actual data
6. Any unverified claim will be rejected

OUTPUT FORMAT (JSON):
{
  "conclusion": "supported" | "unsupported" | "inconclusive",
  "summary": "Brief explanation of your conclusion",
  "candidateRecordIds": ["id1", "id2"],
  "evidence": ["Evidence item 1", "Evidence item 2"],
  "discrepancies": [{"field": "amount", "observation": "..."}],
  "recommendedAction": "Next step for human review"
}

You are NOT the final authority. Deterministic verification has final say.`;
  }
}
