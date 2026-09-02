/**
 * LedgerLens Evidence Packet Builder
 *
 * Builds a constrained evidence packet for AI investigation.
 * Includes ONLY observable data from source records.
 * NEVER includes groundTruth, scenarioType, isTrap, or hidden benchmark metadata.
 */
import type { NormalizedRecord, EngineException } from '../domain/types';
import type { AIInvestigationRequest } from './provider-interface';

/**
 * Builds an evidence packet for a single exception.
 * Only includes observable facts that can be traced to real source records.
 *
 * @param exception The exception being investigated
 * @param sourceRecords The source records linked to this exception
 * @param deterministicFindings Any deterministic findings from the reconciliation engine
 * @param candidateRecordIds Deterministically selected candidate IDs
 * @returns Evidence packet ready for AI provider
 */
export function buildEvidencePacket(
  exception: EngineException,
  sourceRecords: NormalizedRecord[],
  deterministicFindings: string[],
  candidateRecordIds: string[]
): AIInvestigationRequest {
  // Extract only observable fields from source records
  const linkedRecords = sourceRecords.map((r) => ({
    id: r.id,
    source: r.source,
    externalRef: r.externalRef,
    paymentRef: r.paymentRef,
    orderId: r.orderId,
    utr: r.utr,
    amountPaise: r.amountPaise,
    feePaise: r.feePaise,
    taxPaise: r.taxPaise,
    netPaise: r.netPaise,
    occurredAt: r.occurredAt instanceof Date ? r.occurredAt.toISOString() : r.occurredAt,
    settledAt: r.settledAt instanceof Date ? r.settledAt.toISOString() : r.settledAt,
  }));

  return {
    exceptionId: exception.id,
    exceptionType: exception.type,
    exceptionDescription: exception.description,
    evidence: {
      exceptionAmount: exception.amountPaise,
      linkedRecords,
      deterministicFindings,
    },
    candidateRecordIds,
  };
}

/**
 * Extracts deterministic findings from audit events.
 * These are facts that the deterministic engine has already established.
 *
 * @param auditEvents Audit events related to the exception
 * @returns Array of deterministic finding strings
 */
export function extractDeterministicFindings(
  auditEvents: Array<{ reason: string; evidence: string }>
): string[] {
  const findings: string[] = [];

  for (const event of auditEvents) {
    // Extract key deterministic facts
    if (event.reason && event.evidence) {
      findings.push(`${event.reason}: ${event.evidence}`);
    }
  }

  return findings;
}

/**
 * Validates that evidence packet contains no hidden metadata.
 * This is a safety check to ensure no evaluation data leaks to AI.
 *
 * @param evidence The evidence packet to validate
 * @returns true if safe, false if hidden metadata detected
 */
export function validateEvidencePacket(evidence: AIInvestigationRequest): boolean {
  const json = JSON.stringify(evidence);

  // Forbidden terms that indicate evaluation metadata
  const forbiddenTerms = [
    'groundTruth',
    'scenarioType',
    'isTrap',
    'expectedStatus',
    'expectedMatchGroup',
    'expectedOutcome',
    'expectedSubgroups',
  ];

  for (const term of forbiddenTerms) {
    if (json.includes(term)) {
      console.error(`[Evidence] Forbidden term detected in evidence packet: ${term}`);
      return false;
    }
  }

  return true;
}

/**
 * Sanitizes raw JSON from source records before inclusion in evidence.
 * Removes any hidden metadata that might have been preserved.
 *
 * @param rawJson The raw JSON string from a source record
 * @returns Sanitized JSON with no hidden metadata
 */
export function sanitizeRawJson(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson);

    // Remove forbidden fields
    delete parsed.groundTruth;
    delete parsed.scenarioType;
    delete parsed.isTrap;
    delete parsed.expectedStatus;
    delete parsed.expectedMatchGroup;
    delete parsed.expectedOutcome;
    delete parsed.expectedSubgroups;

    return JSON.stringify(parsed);
  } catch {
    // If parsing fails, return empty object
    return '{}';
  }
}
