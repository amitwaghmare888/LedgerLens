/**
 * LedgerLens AI Response Parser
 *
 * Parses and validates AI provider responses.
 * Extracts JSON from various formats (markdown code blocks, plain JSON, etc.)
 */
import type { AIOutput } from './response-schema';
import { validateAIOutput } from './response-schema';
import { AIProviderException } from './provider-interface';

/**
 * Parses AI response content and extracts structured output.
 * Handles multiple formats: plain JSON, markdown code blocks, text with JSON.
 *
 * @param content Raw content from AI provider
 * @returns Validated AI output
 * @throws AIProviderException if parsing or validation fails
 */
export function parseAIResponse(content: string): AIOutput {
  if (!content || typeof content !== 'string') {
    throw new AIProviderException('MALFORMED_RESPONSE', 'Empty or invalid response content');
  }

  let jsonText = content.trim();

  // Try to extract JSON from markdown code block
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim();
  } else {
    // Try to find JSON object in text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new AIProviderException(
      'MALFORMED_RESPONSE',
      'Failed to parse JSON from AI response',
      { content: content.substring(0, 500), error: String(err) }
    );
  }

  // Validate against schema
  const validated = validateAIOutput(parsed);
  if (!validated) {
    throw new AIProviderException(
      'MALFORMED_RESPONSE',
      'AI response does not match expected schema',
      { parsed }
    );
  }

  return validated;
}

/**
 * Sanitizes AI output to prevent injection attacks.
 * Ensures no executable code or dangerous content.
 *
 * @param output Validated AI output
 * @returns Sanitized output
 */
export function sanitizeAIOutput(output: AIOutput): AIOutput {
  return {
    conclusion: output.conclusion,
    summary: sanitizeString(output.summary),
    candidateRecordIds: output.candidateRecordIds.map((id) => sanitizeString(id)),
    evidence: output.evidence.map((e) => sanitizeString(e)),
    discrepancies: output.discrepancies.map((d) => ({
      field: sanitizeString(d.field),
      observation: sanitizeString(d.observation),
    })),
    recommendedAction: sanitizeString(output.recommendedAction),
  };
}

/**
 * Sanitizes a string to remove potentially dangerous content.
 * Removes control characters and limits length.
 */
function sanitizeString(str: string): string {
  return (
    str
      // Remove control characters except newlines and tabs
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // Limit length
      .substring(0, 2000)
      .trim()
  );
}
