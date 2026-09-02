/**
 * LedgerLens AI Provider Interface
 *
 * Abstract interface for LLM providers used in exception investigation.
 * Implementations must be server-side only. No API keys in client code.
 */

export interface AIProviderConfig {
  provider: 'omniroute' | 'gemini' | 'groq';
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface AIInvestigationRequest {
  /** The exception being investigated */
  exceptionId: string;
  exceptionType: string;
  exceptionDescription: string;
  /** Evidence packet (observable facts only) */
  evidence: {
    exceptionAmount: number; // paise
    linkedRecords: Array<{
      id: string;
      source: 'merchant' | 'razorpay' | 'bank';
      externalRef: string;
      paymentRef: string;
      orderId: string;
      utr: string;
      amountPaise: number;
      feePaise: number;
      taxPaise: number;
      netPaise: number;
      occurredAt: string;
      settledAt: string | null;
    }>;
    deterministicFindings: string[];
  };
  /** Deterministically selected candidates (IDs only) */
  candidateRecordIds: string[];
}

export interface AIInvestigationResponse {
  /** Provider name */
  provider: string;
  /** Model used */
  model: string;
  /** Structured output from model */
  output: {
    conclusion: 'supported' | 'unsupported' | 'inconclusive';
    summary: string;
    candidateRecordIds: string[];
    evidence: string[];
    discrepancies: Array<{
      field: string;
      observation: string;
    }>;
    recommendedAction: string;
  };
  /** Token usage (if available) */
  tokensUsed?: number;
  /** Raw response (for debugging/audit) */
  rawResponse?: string;
}

export type AIProviderError =
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'MALFORMED_RESPONSE'
  | 'PROVIDER_ERROR';

export class AIProviderException extends Error {
  constructor(
    public code: AIProviderError,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AIProviderException';
  }
}

/**
 * Abstract AI provider interface.
 * All implementations must be server-side only.
 */
export interface AIProvider {
  investigate(request: AIInvestigationRequest): Promise<AIInvestigationResponse>;
}
