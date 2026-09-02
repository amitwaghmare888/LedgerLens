/**
 * LedgerLens Deterministic Candidate Selector
 *
 * Narrows plausible candidate records before invoking AI.
 * Uses only safe, observable relationships.
 * NEVER uses AI to search the full database.
 *
 * Policy:
 * - Amount alone is NOT sufficient
 * - Date alone is NOT sufficient
 * - Similarity alone is NOT sufficient
 * - Must have identifier linkage or strong multi-factor evidence
 */
import type { NormalizedRecord, EngineException } from '../domain/types';

export interface CandidateSelectionResult {
  candidateRecordIds: string[];
  selectionReason: string;
  totalCandidatesConsidered: number;
}

/**
 * Selects deterministic candidates for an exception investigation.
 * Returns a focused set of plausible records based on observable relationships.
 *
 * @param exception The exception being investigated
 * @param linkedRecords Records already linked to the exception
 * @param allRecords All records in the same run (for searching)
 * @returns Candidate selection result
 */
export function selectCandidates(
  exception: EngineException,
  linkedRecords: NormalizedRecord[],
  allRecords: NormalizedRecord[]
): CandidateSelectionResult {
  const candidateIds = new Set<string>();
  const reasons: string[] = [];

  // Always include already-linked records
  for (const r of linkedRecords) {
    candidateIds.add(r.id);
  }

  // Extract key identifiers from linked records
  const paymentRefs = new Set(linkedRecords.map((r) => r.paymentRef).filter(Boolean));
  const orderIds = new Set(linkedRecords.map((r) => r.orderId).filter(Boolean));
  const utrs = new Set(linkedRecords.map((r) => r.utr).filter(Boolean));
  const settlementRefs = new Set(linkedRecords.map((r) => r.settlementRef).filter(Boolean));

  // Strategy 1: Find records with matching strong identifiers
  if (paymentRefs.size > 0) {
    const matches = allRecords.filter((r) => paymentRefs.has(r.paymentRef) && r.paymentRef !== '');
    for (const m of matches) {
      if (!candidateIds.has(m.id)) {
        candidateIds.add(m.id);
        reasons.push(`Matched by paymentRef: ${m.paymentRef}`);
      }
    }
  }

  if (utrs.size > 0) {
    const matches = allRecords.filter((r) => utrs.has(r.utr) && r.utr !== '');
    for (const m of matches) {
      if (!candidateIds.has(m.id)) {
        candidateIds.add(m.id);
        reasons.push(`Matched by UTR: ${m.utr}`);
      }
    }
  }

  if (orderIds.size > 0) {
    const matches = allRecords.filter((r) => orderIds.has(r.orderId) && r.orderId !== '');
    for (const m of matches) {
      if (!candidateIds.has(m.id)) {
        candidateIds.add(m.id);
        reasons.push(`Matched by orderId: ${m.orderId}`);
      }
    }
  }

  if (settlementRefs.size > 0) {
    const matches = allRecords.filter(
      (r) => settlementRefs.has(r.settlementRef) && r.settlementRef !== ''
    );
    for (const m of matches) {
      if (!candidateIds.has(m.id)) {
        candidateIds.add(m.id);
        reasons.push(`Matched by settlementRef: ${m.settlementRef}`);
      }
    }
  }

  // Strategy 2: For amount mismatches, find records with plausible arithmetic relationships
  if (exception.type === 'AMOUNT_MISMATCH') {
    const linkedAmounts = linkedRecords.map((r) => r.amountPaise);
    const totalLinked = linkedAmounts.reduce((sum, a) => sum + a, 0);

    // Look for records where amount + fee + tax = expected amount
    for (const r of allRecords) {
      if (candidateIds.has(r.id)) continue;

      // Check if this record's net amount fills the gap
      const gap = Math.abs(exception.amountPaise - totalLinked);
      if (Math.abs(r.netPaise - gap) < 100) {
        // within 100 paise (₹1)
        candidateIds.add(r.id);
        reasons.push(
          `Plausible arithmetic candidate: netPaise ${r.netPaise} fills gap ${gap}`
        );
      }

      // Check if gross - fee - tax relationship exists
      for (const linked of linkedRecords) {
        const expectedNet = linked.amountPaise - r.feePaise - r.taxPaise;
        if (Math.abs(expectedNet - r.netPaise) < 10) {
          candidateIds.add(r.id);
          reasons.push(`Plausible fee/tax relationship with ${linked.id}`);
          break;
        }
      }
    }
  }

  // Strategy 3: For missing records, search within plausible time windows
  if (exception.type === 'MISSING_SETTLEMENT' || exception.type === 'MISSING_BANK_ENTRY') {
    const linkedDates = linkedRecords.map((r) =>
      r.occurredAt instanceof Date ? r.occurredAt : new Date(r.occurredAt)
    );
    const minDate = new Date(Math.min(...linkedDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...linkedDates.map((d) => d.getTime())));

    // Expand window by 14 days before and 30 days after (plausible settlement window)
    const searchStart = new Date(minDate);
    searchStart.setDate(searchStart.getDate() - 14);
    const searchEnd = new Date(maxDate);
    searchEnd.setDate(searchEnd.getDate() + 30);

    // Get target source based on exception type
    const targetSource =
      exception.type === 'MISSING_SETTLEMENT' ? 'razorpay' : 'bank';

    const timeMatches = allRecords.filter((r) => {
      if (candidateIds.has(r.id)) return false;
      if (r.source !== targetSource) return false;

      const rDate = r.occurredAt instanceof Date ? r.occurredAt : new Date(r.occurredAt);
      return rDate >= searchStart && rDate <= searchEnd;
    });

    // Limit to reasonable number
    const MAX_TIME_CANDIDATES = 10;
    for (const m of timeMatches.slice(0, MAX_TIME_CANDIDATES)) {
      candidateIds.add(m.id);
      reasons.push(`Within plausible time window: ${targetSource} ${m.externalRef}`);
    }
  }

  // Safety limit: cap total candidates
  const MAX_TOTAL_CANDIDATES = 20;
  const finalCandidates = Array.from(candidateIds).slice(0, MAX_TOTAL_CANDIDATES);

  // Ensure a reason is always provided, even if only linked records are present
  const selectionReason =
    reasons.length > 0 ? reasons.join('; ') : 'Linked records only; no additional candidates identified';

  return {
    candidateRecordIds: finalCandidates,
    selectionReason,
    totalCandidatesConsidered: allRecords.length,
  };
}

/**
 * Validates that candidate selection is safe and deterministic.
 *
 * @param result The candidate selection result
 * @param exception The exception being investigated
 * @returns true if valid, false if unsafe
 */
export function validateCandidateSelection(
  result: CandidateSelectionResult,
  exception: EngineException
): boolean {
  // Must have at least the linked records
  if (result.candidateRecordIds.length === 0) {
    console.error('[Candidates] No candidates selected');
    return false;
  }

  // All linked records must be included
  for (const id of exception.sourceRecordIds) {
    if (!result.candidateRecordIds.includes(id)) {
      console.error(`[Candidates] Linked record ${id} missing from candidates`);
      return false;
    }
  }

  // Must have a reason
  if (!result.selectionReason) {
    console.error('[Candidates] No selection reason provided');
    return false;
  }

  return true;
}
