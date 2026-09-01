/**
 * LedgerLens Reconciliation â€” Engine (Orchestrator)
 *
 * Orchestrates the full reconciliation pipeline:
 *   normalize â†’ exact-match â†’ rule-match â†’ batch-match â†’ classify-exception â†’ prioritize
 *
 * The engine produces EngineResult and does NOT write to the database.
 * Callers (API routes / repository) handle persistence.
 *
 * CRITICAL INVARIANT:
 *   This module and all modules it calls must NOT access:
 *     - isTrap
 *     - scenarioType / groundTruth
 *     - any evaluation metadata
 *   The engine operates ONLY on observable source data (NormalizedRecord[]).
 *
 * BOUNDARY: No React, no DB, no HTTP imports.
 */
import type {
  NormalizedRecord,
  EngineResult,
  EngineMatchDecision,
  EngineException,
  AuditEvent,
  ReconStatus,
} from '../domain/types';
import { runExactMatch } from './exact-match';
import { runRuleMatch, applyRefundRule } from './rule-match';
import { runBatchMatch } from './batch-match';
import { classifyExceptions } from './classify-exception';
import { prioritizeExceptions } from './prioritize';

// ============================================================
// Reference date for priority scoring
// Deterministic anchor: end of synthetic dataset period.
// NOT runtime Date.now().
// ============================================================
const PRIORITY_REFERENCE_DATE = '2025-03-31T23:59:59.000Z';

// ============================================================
// Audit event factory
// occurredAt is always from source data, never from wall clock.
// ============================================================

function makeAuditEvent(
  runId: string,
  entityId: string,
  entityType: AuditEvent['entityType'],
  eventType: AuditEvent['eventType'],
  decision: ReconStatus | null,
  reason: string,
  evidence: string,
  occurredAt: string
): AuditEvent {
  return { runId, eventType, entityType, entityId, decision, reason, evidence, occurredAt };
}

// ============================================================
// Main engine entry point
// ============================================================

export function runReconciliationEngine(
  runId: string,
  records: NormalizedRecord[]
): EngineResult {
  const allDecisions: EngineMatchDecision[] = [];
  const allAuditEvents: AuditEvent[] = [];

  // â”€â”€ Stage 1: Exact Match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const exactMatchResult = runExactMatch(records);

  // Build paymentRef conflict map (multiple razorpay per merchant ref â€” ambiguous)
  const paymentRefConflicts = new Map<string, NormalizedRecord[]>();
  {
    const rzpByRef = new Map<string, NormalizedRecord[]>();
    for (const r of records.filter((r) => r.source === 'razorpay')) {
      const arr = rzpByRef.get(r.paymentRef) ?? [];
      arr.push(r);
      rzpByRef.set(r.paymentRef, arr);
    }
    for (const [ref, rzps] of rzpByRef) {
      if (rzps.length > 1) paymentRefConflicts.set(ref, rzps);
    }
  }

  // â”€â”€ Stage 2: Rule Match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ruleMatchOutput = runRuleMatch(runId, {
    paymentRefCandidates: exactMatchResult.paymentRefCandidates,
    utrCandidates: exactMatchResult.utrCandidates,
    allRecords: records,
  });

  for (const decision of ruleMatchOutput.decisions) {
    allDecisions.push(decision);
    allAuditEvents.push(
      makeAuditEvent(
        runId, decision.id, 'match_decision', 'match_decision',
        decision.status, decision.matchType, decision.evidence, decision.createdAt
      )
    );
  }

  // Also collect exceptions from rule-match (adjustment cases)
  const ruleExceptions: EngineException[] = ruleMatchOutput.exceptions;
  let consumedIds = ruleMatchOutput.consumedIds;

  // ── Stage 2.5: Refund Match ───────────────────────────────────────────────────
  // Detects refund groups using observable evidence only:
  //   E1: merchantRefund.paymentRef === merchantSale.paymentRef
  //   E2: merchantRefund rawJson type === 'refund'
  //   E3: rzpRefund.orderId === rzpPayment.orderId
  //   E4: rzpPayment.utr === bankCredit.utr
  //   E5: rzpRefund.utr === bankDebit.utr
  //   E6: refundAmount === bankDebit.amountPaise
  {
    const unconsumed = records.filter(r => !consumedIds.has(r.id));
    const merchantByPayRef = new Map<string, NormalizedRecord[]>();
    for (const r of unconsumed.filter(r => r.source === 'merchant')) {
      const arr = merchantByPayRef.get(r.paymentRef) ?? [];
      arr.push(r);
      merchantByPayRef.set(r.paymentRef, arr);
    }
    // Find paymentRefs with exactly 2 merchant records (sale + refund)
    for (const [payRef, merchants] of merchantByPayRef) {
      if (merchants.length !== 2) continue;
      // Identify which is sale and which is refund by rawJson type
      let merchantSale: NormalizedRecord | null = null;
      let merchantRefund: NormalizedRecord | null = null;
      for (const m of merchants) {
        try {
          const raw = JSON.parse(m.rawJson) as { type?: string };
          if (raw.type === 'refund') merchantRefund = m;
          else merchantSale = m;
        } catch { merchantSale = m; }
      }
      if (!merchantSale || !merchantRefund) continue;
      // Find matching razorpay records: same orderId as merchant sale's matched razorpay
      const rzpForSale = unconsumed.find(r => r.source === 'razorpay' && r.paymentRef === payRef);
      if (!rzpForSale) continue;
      // Razorpay refund: same orderId but different paymentRef (rfnd_ prefix)
      const rzpRefund = unconsumed.find(r =>
        r.source === 'razorpay' &&
        r.id !== rzpForSale.id &&
        r.orderId === rzpForSale.orderId &&
        r.orderId !== ''
      );
      if (!rzpRefund) continue;
      // Bank credit: matches rzpForSale UTR
      const bankCredit = unconsumed.find(r => r.source === 'bank' && r.utr === rzpForSale.utr);
      if (!bankCredit) continue;
      // Bank debit: matches rzpRefund UTR
      const bankDebit = unconsumed.find(r => r.source === 'bank' && r.utr === rzpRefund.utr);
      if (!bankDebit) continue;
      // Apply the 6-point refund rule
      const outcome = applyRefundRule(runId, merchantSale, merchantRefund, rzpForSale, rzpRefund, bankCredit, bankDebit);
      if (outcome.type === 'decision') {
        allDecisions.push(outcome.decision);
        allAuditEvents.push(makeAuditEvent(
          runId, outcome.decision.id, 'match_decision', 'match_decision',
          outcome.decision.status, outcome.decision.matchType, outcome.decision.evidence, outcome.decision.createdAt
        ));
        for (const id of outcome.decision.sourceRecordIds) consumedIds.add(id);
      }
    }
  }

  // â”€â”€ Stage 3: Batch Match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const batchMatchOutput = runBatchMatch(
    runId,
    exactMatchResult.batchGroups,
    records,
    consumedIds
  );

  for (const decision of batchMatchOutput.decisions) {
    allDecisions.push(decision);
    allAuditEvents.push(
      makeAuditEvent(
        runId, decision.id, 'match_decision', 'match_decision',
        decision.status, decision.matchType, decision.evidence, decision.createdAt
      )
    );
  }

  consumedIds = batchMatchOutput.consumedIds;

  // â”€â”€ Stage 4: Classify Exceptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const classifiedExceptions = classifyExceptions(runId, {
    allRecords: records,
    consumedIds,
    paymentRefConflicts,
  });

  // Merge rule exceptions + classified exceptions
  const allExceptions: EngineException[] = [...ruleExceptions, ...classifiedExceptions];

  // â”€â”€ Stage 5: Prioritize â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const prioritizedExceptions = prioritizeExceptions(allExceptions, PRIORITY_REFERENCE_DATE);

  // Add audit events for exceptions
  for (const exc of prioritizedExceptions) {
    allAuditEvents.push(
      makeAuditEvent(
        runId, exc.id, 'exception', 'exception_raised',
        'UNRESOLVED', exc.type, exc.description, exc.createdAt
      )
    );
  }

  return {
    runId,
    decisions: allDecisions,
    exceptions: prioritizedExceptions,
    auditEvents: allAuditEvents,
  };
}