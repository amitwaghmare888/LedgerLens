/**
 * LedgerLens AI Prompt Builder
 *
 * Constructs investigation prompts from evidence packets.
 * Keeps prompts concise to minimize token usage.
 */
import type { AIInvestigationRequest } from './provider-interface';
import { paiseToRupeeDisplay } from '../lib/money';

/**
 * Builds a concise investigation prompt from evidence packet.
 *
 * @param request The investigation request with evidence
 * @returns Formatted prompt for AI provider
 */
export function buildInvestigationPrompt(request: AIInvestigationRequest): string {
  const lines: string[] = [];

  // Header
  lines.push('# Financial Reconciliation Exception Investigation');
  lines.push('');
  lines.push(`Exception ID: ${request.exceptionId}`);
  lines.push(`Exception Type: ${request.exceptionType}`);
  lines.push(`Amount Exposure: ₹${paiseToRupeeDisplay(request.evidence.exceptionAmount)}`);
  lines.push('');

  // Description
  lines.push('## Exception Description');
  lines.push(request.exceptionDescription);
  lines.push('');

  // Deterministic findings
  if (request.evidence.deterministicFindings.length > 0) {
    lines.push('## Deterministic Engine Findings');
    for (const finding of request.evidence.deterministicFindings) {
      lines.push(`- ${finding}`);
    }
    lines.push('');
  }

  // Linked records
  lines.push('## Linked Source Records');
  for (const record of request.evidence.linkedRecords) {
    lines.push(`### ${record.source.toUpperCase()} Record: ${record.id}`);
    lines.push(`- External Ref: ${record.externalRef}`);
    if (record.paymentRef) lines.push(`- Payment Ref: ${record.paymentRef}`);
    if (record.orderId) lines.push(`- Order ID: ${record.orderId}`);
    if (record.utr) lines.push(`- UTR: ${record.utr}`);
    lines.push(`- Gross Amount: ₹${paiseToRupeeDisplay(record.amountPaise)}`);
    if (record.feePaise > 0) lines.push(`- Fee: ₹${paiseToRupeeDisplay(record.feePaise)}`);
    if (record.taxPaise > 0) lines.push(`- Tax: ₹${paiseToRupeeDisplay(record.taxPaise)}`);
    lines.push(`- Net Amount: ₹${paiseToRupeeDisplay(record.netPaise)}`);
    lines.push(`- Occurred At: ${record.occurredAt}`);
    if (record.settledAt) lines.push(`- Settled At: ${record.settledAt}`);
    lines.push('');
  }

  // Candidate IDs
  lines.push('## Candidate Record IDs');
  lines.push(
    'You may ONLY reference these record IDs in your analysis. Do not fabricate new IDs.'
  );
  for (const id of request.candidateRecordIds) {
    lines.push(`- ${id}`);
  }
  lines.push('');

  // Instructions
  lines.push('## Your Task');
  lines.push(
    'Analyze the evidence above and provide your structured conclusion in JSON format.'
  );
  lines.push('Remember:');
  lines.push('- Only reference candidate record IDs listed above');
  lines.push('- Only cite evidence items provided above');
  lines.push('- Never fabricate amounts, dates, or identifiers');
  lines.push('- If evidence is insufficient, return conclusion: "inconclusive"');
  lines.push('- Your output will be deterministically verified');
  lines.push('');
  lines.push('Respond with valid JSON only (no markdown, no code blocks):');

  return lines.join('\n');
}
