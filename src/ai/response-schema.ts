/**
 * LedgerLens AI Response Schema
 *
 * Zod schema for validating structured AI output.
 * Rejects malformed responses before deterministic verification.
 */
import { z } from 'zod';

/**
 * Schema for discrepancy observations in AI output
 */
export const DiscrepancySchema = z.object({
  field: z.string().min(1).max(100),
  observation: z.string().min(1).max(500),
});

/**
 * Schema for structured AI investigation output
 */
export const AIOutputSchema = z.object({
  conclusion: z.enum(['supported', 'unsupported', 'inconclusive']),
  summary: z.string().min(10).max(1000),
  candidateRecordIds: z.array(z.string()).max(20),
  evidence: z.array(z.string()).max(20),
  discrepancies: z.array(DiscrepancySchema).max(10),
  recommendedAction: z.string().min(10).max(500),
});

export type AIOutput = z.infer<typeof AIOutputSchema>;

/**
 * Validates AI output against schema.
 * Returns parsed output if valid, null if invalid.
 *
 * @param output Raw output from AI provider
 * @returns Validated output or null
 */
export function validateAIOutput(output: unknown): AIOutput | null {
  const result = AIOutputSchema.safeParse(output);
  if (!result.success) {
    console.error('[AI Schema] Validation failed:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Schema for complete AI investigation result (after verification)
 */
export const InvestigationResultSchema = z.object({
  exceptionId: z.string(),
  provider: z.string(),
  model: z.string(),
  aiOutput: AIOutputSchema,
  verificationStatus: z.enum(['AI_SUPPORTED', 'AI_REJECTED', 'INCONCLUSIVE', 'AI_UNAVAILABLE']),
  verificationDetails: z.string(),
  timestamp: z.string(),
  tokensUsed: z.number().optional(),
});

export type InvestigationResult = z.infer<typeof InvestigationResultSchema>;
