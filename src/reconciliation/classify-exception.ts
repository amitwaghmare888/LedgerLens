/**
 * LedgerLens Reconciliation — Classify Exception
 *
 * For all unresolved records remaining after Stages 1-3, classify into
 * typed exceptions where evidence supports it.
 *
 * Policy: Do not force a classification when evidence is insufficient.
 * UNSUPPORTED_CASE is the honest fallback.
 *
 * BOUNDARY: No React, no DB, no HTTP imports.
 */
import type {
  NormalizedRecord,
  EngineException,
  ExceptionType,
  ExceptionSeverity,
} from '../domain/types';
import { deterministicId } from '../lib/deterministic';
import { paiseToRupeeDisplay } from '../lib/money';

// ============================================================
// Helpers
// ============================================================

function recordOccurredAt(records: NormalizedRecord[]): string {
  const dates = records
    .map((r) => (r.occurredAt instanceof Date ? r.occurredAt.getTime() : new Date(r.occurredAt as string).getTime()))
    .filter((t) => !isNaN(t));
  if (dates.length === 0) return new Date(0).toISOString();
  return new Date(Math.min(...dates)).toISOString();
}

function makeException(
  runId: string,
  records: NormalizedRecord[],
  type: ExceptionType,
  severity: ExceptionSeverity,
  description: string
): EngineException {
  const amountPaise = records.reduce((sum, r) => sum + Math.abs(r.amountPaise), 0);
  const id = deterministicId('exc', runId, type, ...records.map((r) => r.id));
  return {
    id,
    runId,
    sourceRecordIds: records.map((r) => r.id),
    type,
    severity,
    amountPaise,
    description,
    priorityScore: 0, // Set by prioritize.ts
    createdAt: recordOccurredAt(records),
  };
}

// ============================================================
// Classification functions
// ============================================================

/**
 * Classify a merchant record with no matching razorpay.
 * Evidence: merchant record exists, no razorpay record found by paymentRef.
 */
export function classifyMissingSettlement(
  runId: string,
  merchant: NormalizedRecord
): EngineException {
  return makeException(
    runId,
    [merchant],
    'MISSING_SETTLEMENT',
    'high',
    `Merchant record ${merchant.externalRef} has no matching Razorpay settlement. ` +
      `PaymentRef ${merchant.paymentRef} not found in Razorpay data. ` +
      `Possible unrecorded payment or data gap.`
  );
}

/**
 * Classify merchant+razorpay with no bank entry.
 * Evidence: paymentRef links merchant and razorpay, but UTR produces no bank record.
 */
export function classifyMissingBankEntry(
  runId: string,
  merchant: NormalizedRecord,
  razorpay: NormalizedRecord
): EngineException {
  return makeException(
    runId,
    [merchant, razorpay],
    'MISSING_BANK_ENTRY',
    'medium',
    `Merchant record ${merchant.externalRef} and Razorpay record ${razorpay.externalRef} ` +
      `are linked by paymentRef ${razorpay.paymentRef}, but no bank credit found for UTR ${razorpay.utr}. ` +
      `Settlement may be pending or bank data is incomplete.`
  );
}

/**
 * Classify records linked by identifier but financial arithmetic fails.
 * Evidence: identifier matches, but amounts don't reconcile via any rule.
 */
export function classifyAmountMismatch(
  runId: string,
  records: NormalizedRecord[],
  differencePaise: number
): EngineException {
  return makeException(
    runId,
    records,
    'AMOUNT_MISMATCH',
    'high',
    `Records are linked by identifier but financial arithmetic fails. ` +
      `Unexplained difference: ${paiseToRupeeDisplay(Math.abs(differencePaise))}. ` +
      `No rule accounts for this gap. Manual review required.`
  );
}

/**
 * Classify records that are linked but dates are implausibly far apart.
 */
export function classifyTimingMismatch(
  runId: string,
  records: NormalizedRecord[],
  diffDays: number
): EngineException {
  return makeException(
    runId,
    records,
    'TIMING_MISMATCH',
    'medium',
    `Records are linked by identifier but date difference (${diffDays} days) ` +
      `exceeds any plausible settlement window. May indicate data from different periods.`
  );
}

/**
 * Classify a razorpay record with no corresponding bank entry and no merchant.
 * (orphaned razorpay record)
 */
export function classifyOrphanedRazorpay(
  runId: string,
  razorpay: NormalizedRecord
): EngineException {
  return makeException(
    runId,
    [razorpay],
    'MISSING_BANK_ENTRY',
    'medium',
    `Razorpay record ${razorpay.externalRef} has no corresponding bank credit via UTR ${razorpay.utr}. ` +
      `No merchant record either. May be a test transaction or data gap.`
  );
}

/**
 * Classify a bank record with no matching razorpay.
 */
export function classifyOrphanedBankEntry(
  runId: string,
  bank: NormalizedRecord
): EngineException {
  return makeException(
    runId,
    [bank],
    'MISSING_SETTLEMENT',
    'high',
    `Bank credit ${bank.externalRef} (UTR: ${bank.utr}) has no corresponding Razorpay settlement. ` +
      `May indicate an unrecorded settlement or incorrect bank data.`
  );
}

/**
 * Classify when multiple candidates exist for the same identifier.
 */
export function classifyAmbiguousMatch(
  runId: string,
  records: NormalizedRecord[],
  linkingIdentifier: string
): EngineException {
  return makeException(
    runId,
    records,
    'AMBIGUOUS_MATCH',
    'medium',
    `Multiple records share identifier ${linkingIdentifier}. ` +
      `Cannot determine correct match without additional evidence. Manual review required.`
  );
}

/**
 * Classify when no specific pattern fits.
 */
export function classifyUnsupportedCase(
  runId: string,
  records: NormalizedRecord[]
): EngineException {
  return makeException(
    runId,
    records,
    'UNSUPPORTED_CASE',
    'low',
    `Unresolved records do not match any supported exception pattern. ` +
      `${records.map((r) => `${r.source}:${r.externalRef}`).join(', ')}. ` +
      `Manual investigation required.`
  );
}

// ============================================================
// Main classification dispatcher
// ============================================================

export interface ClassificationInput {
  allRecords: NormalizedRecord[];
  consumedIds: Set<string>;
  /** paymentRef → [razorpay records] for ambiguity detection */
  paymentRefConflicts: Map<string, NormalizedRecord[]>;
}

export function classifyExceptions(
  runId: string,
  input: ClassificationInput
): EngineException[] {
  const { allRecords, consumedIds, paymentRefConflicts } = input;
  const exceptions: EngineException[] = [];
  const classifiedIds = new Set<string>();

  const merchantRecords = allRecords.filter((r) => r.source === 'merchant' && !consumedIds.has(r.id));
  const razorpayRecords = allRecords.filter((r) => r.source === 'razorpay' && !consumedIds.has(r.id));
  const bankRecords = allRecords.filter((r) => r.source === 'bank' && !consumedIds.has(r.id));

  // Build lookup indices
  const rzpByPaymentRef = new Map<string, NormalizedRecord[]>();
  for (const rzp of razorpayRecords) {
    const existing = rzpByPaymentRef.get(rzp.paymentRef) ?? [];
    existing.push(rzp);
    rzpByPaymentRef.set(rzp.paymentRef, existing);
  }

  const bankByUtr = new Map<string, NormalizedRecord[]>();
  for (const b of bankRecords) {
    const existing = bankByUtr.get(b.utr) ?? [];
    existing.push(b);
    bankByUtr.set(b.utr, existing);
  }

  // 1. Ambiguous matches (multiple razorpay for same paymentRef)
  for (const [ref, records] of paymentRefConflicts) {
    if (records.some((r) => !consumedIds.has(r.id))) {
      const affected = records.filter((r) => !consumedIds.has(r.id));
      const exc = classifyAmbiguousMatch(runId, affected, ref);
      affected.forEach((r) => classifiedIds.add(r.id));
      exceptions.push(exc);
    }
  }

  // 2. Merchant with no razorpay
  for (const merchant of merchantRecords) {
    if (classifiedIds.has(merchant.id)) continue;
    if (!merchant.paymentRef) {
      exceptions.push(classifyUnsupportedCase(runId, [merchant]));
      classifiedIds.add(merchant.id);
      continue;
    }
    const matchingRzp = rzpByPaymentRef.get(merchant.paymentRef);
    if (!matchingRzp || matchingRzp.every((r) => consumedIds.has(r.id))) {
      exceptions.push(classifyMissingSettlement(runId, merchant));
      classifiedIds.add(merchant.id);
    }
  }

  // 3. Razorpay+merchant linked but no bank entry
  for (const rzp of razorpayRecords) {
    if (classifiedIds.has(rzp.id) || consumedIds.has(rzp.id)) continue;

    const linkedMerchant = merchantRecords.find(
      (m) => m.paymentRef === rzp.paymentRef && !classifiedIds.has(m.id)
    );

    const bankForUtr = rzp.utr ? (bankByUtr.get(rzp.utr) ?? []) : [];
    const availableBank = bankForUtr.filter((b) => !consumedIds.has(b.id));

    if (linkedMerchant && availableBank.length === 0) {
      exceptions.push(classifyMissingBankEntry(runId, linkedMerchant, rzp));
      classifiedIds.add(rzp.id);
      classifiedIds.add(linkedMerchant.id);
    } else if (!linkedMerchant && availableBank.length === 0) {
      exceptions.push(classifyOrphanedRazorpay(runId, rzp));
      classifiedIds.add(rzp.id);
    }
    // If there IS a bank record available but razorpay is still unconsumed,
    // this means they were linked but rule-match couldn't resolve — amount mismatch
    else if (availableBank.length > 0 && !classifiedIds.has(rzp.id)) {
      const bank = availableBank[0];
      const records = linkedMerchant ? [linkedMerchant, rzp, bank] : [rzp, bank];
      const diff = rzp.netPaise - bank.amountPaise;
      exceptions.push(classifyAmountMismatch(runId, records, diff));
      classifiedIds.add(rzp.id);
      if (linkedMerchant) classifiedIds.add(linkedMerchant.id);
      classifiedIds.add(bank.id);
    }
  }

  // 4. Orphaned bank records
  for (const bank of bankRecords) {
    if (classifiedIds.has(bank.id) || consumedIds.has(bank.id)) continue;
    exceptions.push(classifyOrphanedBankEntry(runId, bank));
    classifiedIds.add(bank.id);
  }

  return exceptions;
}
