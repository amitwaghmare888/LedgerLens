/**
 * LedgerLens Reconciliation — Exact Match (Stage 1)
 *
 * Matches records using only the strongest, source-pair-appropriate identifiers.
 *
 * Identifier relationships are source-pair specific:
 *
 * paymentRef  merchant ↔ razorpay   Both records describe the same gateway payment.
 * utr         razorpay ↔ bank       The razorpay settlement was credited via this bank transfer.
 * settlementId razorpay ↔ razorpay  Records belong to the same settlement batch (grouping only).
 *
 * IMPORTANT: settlementId is a grouping relationship only.
 * It does NOT produce a MATCHED result on its own.
 * Batch financial verification is handled by batch-match.ts.
 *
 * BOUNDARY: No React, no DB, no HTTP imports.
 */
import type { NormalizedRecord } from '../domain/types';

// ============================================================
// Match Candidate
// A linked group of records with the identifier that linked them.
// Not yet a decision — the engine assigns decisions after all stages.
// ============================================================

export type MatchCandidateType =
  | 'exact-payment-ref'      // merchant ↔ razorpay via paymentRef
  | 'exact-utr'              // razorpay ↔ bank via UTR
  | 'batch-group';           // razorpay members of a settlement batch (grouping only)

export interface MatchCandidate {
  type: MatchCandidateType;
  /** The identifier value that linked these records. */
  linkingIdentifier: string;
  /** Records in this candidate group. */
  records: NormalizedRecord[];
}

// ============================================================
// Index helpers
// ============================================================

function buildIndex<T>(
  records: T[],
  key: (r: T) => string
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of records) {
    const k = key(r);
    if (!k) continue;
    const existing = map.get(k);
    if (existing) {
      existing.push(r);
    } else {
      map.set(k, [r]);
    }
  }
  return map;
}

// ============================================================
// Stage 1a — exact-payment-ref: merchant ↔ razorpay
//
// For each razorpay record with a non-empty paymentRef,
// find the merchant record with the same paymentRef.
// Valid ONLY for this source pair.
// Does not infer bank membership from this link.
// ============================================================

export function matchByPaymentRef(
  merchantRecords: NormalizedRecord[],
  razorpayRecords: NormalizedRecord[]
): MatchCandidate[] {
  const merchantByRef = buildIndex(merchantRecords, (r) => r.paymentRef);
  const candidates: MatchCandidate[] = [];

  for (const rzp of razorpayRecords) {
    if (!rzp.paymentRef) continue;
    const merchants = merchantByRef.get(rzp.paymentRef);
    if (!merchants || merchants.length === 0) continue;
    if (merchants.length > 1) {
      // Multiple merchants with same paymentRef — ambiguous, skip exact match
      // classify-exception.ts will handle as AMBIGUOUS_MATCH
      continue;
    }
    candidates.push({
      type: 'exact-payment-ref',
      linkingIdentifier: rzp.paymentRef,
      records: [merchants[0], rzp],
    });
  }

  return candidates;
}

// ============================================================
// Stage 1b — exact-utr: razorpay ↔ bank
//
// For each razorpay record with a non-empty UTR,
// find the bank record with the same UTR.
// Valid ONLY for razorpay ↔ bank.
// A matching UTR does not by itself prove amounts are correct.
// ============================================================

export function matchByUtr(
  razorpayRecords: NormalizedRecord[],
  bankRecords: NormalizedRecord[]
): MatchCandidate[] {
  const bankByUtr = buildIndex(bankRecords, (r) => r.utr);
  const candidates: MatchCandidate[] = [];

  for (const rzp of razorpayRecords) {
    if (!rzp.utr) continue;
    const banks = bankByUtr.get(rzp.utr);
    if (!banks || banks.length === 0) continue;
    if (banks.length > 1) {
      // Multiple bank records with same UTR — ambiguous
      continue;
    }
    candidates.push({
      type: 'exact-utr',
      linkingIdentifier: rzp.utr,
      records: [rzp, banks[0]],
    });
  }

  return candidates;
}

// ============================================================
// Stage 1c — batch-group: razorpay ↔ razorpay via settlementId + UTR
//
// Groups all razorpay records sharing the same settlementId AND the same UTR.
// This is a GROUPING RELATIONSHIP ONLY — not a match decision.
// The bank credit is NOT linked here; batch-match.ts handles financial verification.
//
// A razorpay record is only included in a batch group if it has a non-empty
// settlementId AND a non-empty UTR. settlementId alone is insufficient.
// ============================================================

export interface BatchGroup {
  settlementId: string;
  utr: string;
  razorpayRecords: NormalizedRecord[];
}

export function groupBatchSettlements(
  razorpayRecords: NormalizedRecord[]
): BatchGroup[] {
  // Group by settlementId + UTR (both required)
  const groupMap = new Map<string, NormalizedRecord[]>();

  for (const rzp of razorpayRecords) {
    if (!rzp.settlementRef || !rzp.utr) continue;
    const key = `${rzp.settlementRef}::${rzp.utr}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.push(rzp);
    } else {
      groupMap.set(key, [rzp]);
    }
  }

  const groups: BatchGroup[] = [];
  for (const [key, records] of groupMap.entries()) {
    if (records.length < 2) continue; // Single record is not a batch
    const [settlementId, utr] = key.split('::');
    groups.push({
      settlementId,
      utr,
      razorpayRecords: records.slice().sort((a, b) =>
        a.externalRef.localeCompare(b.externalRef)
      ),
    });
  }

  return groups;
}

// ============================================================
// Main exact-match function
// Returns all candidates for the engine to process.
// ============================================================

export interface ExactMatchResult {
  paymentRefCandidates: MatchCandidate[];
  utrCandidates: MatchCandidate[];
  batchGroups: BatchGroup[];
}

export function runExactMatch(records: NormalizedRecord[]): ExactMatchResult {
  const merchantRecords = records.filter((r) => r.source === 'merchant');
  const razorpayRecords = records.filter((r) => r.source === 'razorpay');
  const bankRecords = records.filter((r) => r.source === 'bank');

  return {
    paymentRefCandidates: matchByPaymentRef(merchantRecords, razorpayRecords),
    utrCandidates: matchByUtr(razorpayRecords, bankRecords),
    batchGroups: groupBatchSettlements(razorpayRecords),
  };
}
