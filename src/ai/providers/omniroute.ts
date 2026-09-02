/**
 * OmniRoute AI Provider Adapter
 *
 * Server-side only. Uses HTTP to communicate with OmniRoute API.
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

export class OmniRouteProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    if (config.provider !== 'omniroute') {
      throw new Error('Invalid provider config for OmniRoute');
    }
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl ?? 'https://api.omniroute.ai/v1';
  }

  async investigate(request: AIInvestigationRequest): Promise<AIInvestigationResponse> {
    const prompt = buildInvestigationPrompt(request);
    const systemPrompt = this.getSystemPrompt();

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
              content: systemPrompt,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
          stream: false,
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (!response.ok) {
        const errorBody = await response.text();
        
        if (response.status === 401) {
          throw new AIProviderException('INVALID_API_KEY', 'OmniRoute API key is invalid');
        }
        if (response.status === 429) {
          throw new AIProviderException('RATE_LIMIT', 'OmniRoute rate limit exceeded');
        }
        throw new AIProviderException(
          'PROVIDER_ERROR',
          `OmniRoute API error: ${response.status}`,
          { status: response.status, body: errorBody }
        );
      }

      const data = await response.json();

      if (!data.choices?.[0]?.message?.content) {
        throw new AIProviderException('MALFORMED_RESPONSE', 'OmniRoute response missing content');
      }

      const content = data.choices[0].message.content;
      const output = parseAIResponse(content);

      return {
        provider: 'omniroute',
        model: this.model,
        output,
        tokensUsed: data.usage?.total_tokens,
        rawResponse: content,
      };
    } catch (err) {
      if (err instanceof AIProviderException) throw err;
      if ((err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') {
        throw new AIProviderException('TIMEOUT', 'OmniRoute request timed out');
      }
      throw new AIProviderException('PROVIDER_UNAVAILABLE', 'Failed to reach OmniRoute', err);
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
