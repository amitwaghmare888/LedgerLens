/**
 * Tests for AI Response Parser
 *
 * Ensures malformed responses are safely rejected.
 */
import { describe, it, expect } from 'vitest';
import { parseAIResponse } from '../response-parser';
import { AIProviderException } from '../provider-interface';

describe('AI Response Parser', () => {
  it('parses plain JSON response', () => {
    const response = JSON.stringify({
      conclusion: 'supported',
      summary: 'Test summary that is long enough to pass validation',
      candidateRecordIds: ['id1', 'id2'],
      evidence: ['Evidence 1'],
      discrepancies: [],
      recommendedAction: 'Accept this match',
    });

    const result = parseAIResponse(response);
    expect(result.conclusion).toBe('supported');
    expect(result.candidateRecordIds).toEqual(['id1', 'id2']);
  });

  it('extracts JSON from markdown code block', () => {
    const response = `Here's my analysis:
\`\`\`json
{
  "conclusion": "inconclusive",
  "summary": "Insufficient evidence",
  "candidateRecordIds": [],
  "evidence": [],
  "discrepancies": [],
  "recommendedAction": "Manual review"
}
\`\`\``;

    const result = parseAIResponse(response);
    expect(result.conclusion).toBe('inconclusive');
  });

  it('extracts JSON from text with surrounding content', () => {
    const response = `Based on my analysis, here is the result:

{
  "conclusion": "unsupported",
  "summary": "No matching identifiers",
  "candidateRecordIds": ["id1"],
  "evidence": ["No paymentRef match"],
  "discrepancies": [],
  "recommendedAction": "Keep as exception"
}

This is my recommendation.`;

    const result = parseAIResponse(response);
    expect(result.conclusion).toBe('unsupported');
  });

  it('throws on empty response', () => {
    expect(() => parseAIResponse('')).toThrow(AIProviderException);
  });

  it('throws on non-JSON response', () => {
    expect(() => parseAIResponse('This is just text without JSON')).toThrow(AIProviderException);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseAIResponse('{invalid json')).toThrow(AIProviderException);
  });

  it('throws on JSON missing required fields', () => {
    const invalidResponse = JSON.stringify({
      conclusion: 'supported',
      // Missing summary, candidateRecordIds, etc.
    });

    expect(() => parseAIResponse(invalidResponse)).toThrow(AIProviderException);
  });

  it('throws on invalid conclusion value', () => {
    const invalidResponse = JSON.stringify({
      conclusion: 'maybe', // Invalid value
      summary: 'Test',
      candidateRecordIds: [],
      evidence: [],
      discrepancies: [],
      recommendedAction: 'Test',
    });

    expect(() => parseAIResponse(invalidResponse)).toThrow(AIProviderException);
  });

  it('rejects excessively long summary', () => {
    const longSummary = 'x'.repeat(2000);
    const response = JSON.stringify({
      conclusion: 'supported',
      summary: longSummary,
      candidateRecordIds: [],
      evidence: [],
      discrepancies: [],
      recommendedAction: 'Accept',
    });

    expect(() => parseAIResponse(response)).toThrow(AIProviderException);
  });

  it('rejects too many candidate IDs', () => {
    const tooManyCandidates = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    const response = JSON.stringify({
      conclusion: 'supported',
      summary: 'Test',
      candidateRecordIds: tooManyCandidates,
      evidence: [],
      discrepancies: [],
      recommendedAction: 'Accept',
    });

    expect(() => parseAIResponse(response)).toThrow(AIProviderException);
  });
});
