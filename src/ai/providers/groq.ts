/**
 * Groq AI Provider Adapter
 *
 * Server-side only. Uses HTTP to communicate with Groq API.
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

export class GroqProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    if (config.provider !== 'groq') {
      throw new Error('Invalid provider config for Groq');
    }
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl ?? 'https://api.groq.com/openai/v1';
  }

  async investigate(request: AIInvestigationRequest): Promise<AIInvestigationResponse> {
    const prompt = buildInvestigationPrompt(request);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AIProviderException('INVALID_API_KEY', 'Groq API key is invalid');
        }
        if (response.status === 429) {
          throw new AIProviderException('RATE_LIMIT', 'Groq rate limit exceeded');
        }
        throw new AIProviderException(
          'PROVIDER_ERROR',
          `Groq API error: ${response.status}`,
          { status: response.status }
        );
      }

      const data = await response.json();

      if (!data.choices?.[0]?.message?.content) {
        throw new AIProviderException('MALFORMED_RESPONSE', 'Groq response missing content');
      }

      const content = data.choices[0].message.content;
      const output = parseAIResponse(content);

      return {
        provider: 'groq',
        model: this.model,
        output,
        tokensUsed: data.usage?.total_tokens,
        rawResponse: content,
      };
    } catch (err) {
      if (err instanceof AIProviderException) throw err;
      if ((err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') {
        throw new AIProviderException('TIMEOUT', 'Groq request timed out');
      }
      throw new AIProviderException('PROVIDER_UNAVAILABLE', 'Failed to reach Groq', err);
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
