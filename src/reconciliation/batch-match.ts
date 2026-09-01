/**
 * LedgerLens Reconciliation — Batch Match (Stage 3)
 *
 * Resolves batch settlements where N merchant+razorpay records map to one bank credit.
 *
 * Requires BOTH:
 * 1. Grouping evidence: all razorpay records share the same settlementId AND the same UTR.
 *    The bank record must have the same UTR.
 * 2. Financial verification: sum(razorpay[i].netPaise) == bank.amountPaise.
 *
 * UTR-only or amount-only is insufficient evidence.
 * settlementId alone is NOT a match — it is only a grouping hint.
 *
 * If the financial total does not match, the group is UNRESOLVED.
 * If the bank record cannot be found by UTR, the group is UNRESOLVED.
 *
 * BOUNDARY: No React, no DB, no HTTP imports.
 */
import type { NormalizedRecord, EngineMatchDecision } from '../domain/types';
import type { BatchGroup } from './exact-match';
import { deterministicId } from '../lib/deterministic';
import { sumPaise, paiseToRupeeDisplay } from '../lib/money';

// ============================================================
// Batch Match Result
// ============================================================

export type BatchMatchOutcome =
  | { type: 'matched'; decision: EngineMatchDecision }
  | { type: 'unresolved'; reason: string; group: BatchGroup };

// ============================================================
// Apply batch match to a single group
// ============================================================

export function applyBatchMatch(
  runId: string,
  group: BatchGroup,
  bankRecords: NormalizedRecord[],
  consumedIds: Set<string>
): BatchMatchOutcome {
  // Skip if any razorpay records in this group are already consumed
  for (const rzp of group.razorpayRecords) {
    if (consumedIds.has(rzp.id)) {
      return {
        type: 'unresolved',
        reason: `One or more razorpay records in batch ${group.settlementId} already consumed by another rule.`,
        group,
      };
    }
  }

  // Find the bank record by UTR (grouping evidence requirement)
  const matchingBankRecords = bankRecords.filter(
    (b) => b.utr === group.utr && b.source === 'bank' && !consumedIds.has(b.id)
  );

  if (matchingBankRecords.length === 0) {
    return {
      type: 'unresolved',
      reason: `No bank record found with UTR ${group.utr} for batch settlementId ${group.settlementId}.`,
      group,
    };
  }

  if (matchingBankRecords.length > 1) {
    return {
      type: 'unresolved',
      reason: `Multiple bank records found with UTR ${group.utr} — ambiguous batch.`,
      group,
    };
  }

  const bank = matchingBankRecords[0];

  // Financial verification: sum of net amounts must equal bank credit
  const netAmounts = group.razorpayRecords.map((r) => r.netPaise);
  const totalNet = sumPaise(netAmounts);

  if (totalNet !== bank.amountPaise) {
    return {
      type: 'unresolved',
      reason:
        `Batch total mismatch: sum of razorpay net amounts ` +
        `${paiseToRupeeDisplay(totalNet)} != bank credit ${paiseToRupeeDisplay(bank.amountPaise)}.`,
      group,
    };
  }

  // Both grouping evidence and financial total verified
  const n = group.razorpayRecords.length;
  const allIds = [...group.razorpayRecords.map((r) => r.id), bank.id];
  const id = deterministicId('dec', runId, group.settlementId, group.utr);

  const evidence =
    `Batch of ${n} razorpay records grouped by settlementId ${group.settlementId} and UTR ${group.utr}. ` +
    `Sum of net amounts ${paiseToRupeeDisplay(totalNet)} matches bank credit ${paiseToRupeeDisplay(bank.amountPaise)} exactly.`;

  // Find earliest occurredAt from razorpay records (deterministic, from source data)
  const times = group.razorpayRecords
    .map((r) => (r.occurredAt instanceof Date ? r.occurredAt.getTime() : new Date(r.occurredAt as string).getTime()))
    .filter((t) => !isNaN(t));
  const createdAt = times.length > 0 ? new Date(Math.min(...times)).toISOString() : new Date(0).toISOString();

  return {
    type: 'matched',
    decision: {
      id,
      runId,
      sourceRecordIds: allIds,
      status: 'MATCHED',
      matchType: 'batch-settlement',
      differencePaise: 0,
      evidence,
      createdAt,
    },
  };
}

// ============================================================
// Run batch matching for all groups
// ============================================================

export interface BatchMatchOutput {
  decisions: EngineMatchDecision[];
  unresolvedGroups: Array<{ reason: string; group: BatchGroup }>;
  consumedIds: Set<string>;
}

export function runBatchMatch(
  runId: string,
  batchGroups: BatchGroup[],
  allRecords: NormalizedRecord[],
  consumedIds: Set<string>
): BatchMatchOutput {
  const bankRecords = allRecords.filter((r) => r.source === 'bank');
  const decisions: EngineMatchDecision[] = [];
  const unresolvedGroups: Array<{ reason: string; group: BatchGroup }> = [];
  const newConsumedIds = new Set<string>(consumedIds);

  for (const group of batchGroups) {
    const outcome = applyBatchMatch(runId, group, bankRecords, newConsumedIds);

    if (outcome.type === 'matched') {
      decisions.push(outcome.decision);
      outcome.decision.sourceRecordIds.forEach((id) => newConsumedIds.add(id));
    } else {
      unresolvedGroups.push({ reason: outcome.reason, group: outcome.group });
    }
  }

  return { decisions, unresolvedGroups, consumedIds: newConsumedIds };
}
