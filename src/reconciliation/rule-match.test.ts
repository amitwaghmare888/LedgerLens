/**
 * Tests: rule-match.ts, batch-match.ts, classify-exception.ts, prioritize.ts
 * Covers: all rule cases, batch matching, exception classification, priority scoring, negative tests.
 */
import { describe, it, expect } from 'vitest';
import { applyFeeTaxRule, applyTimingRule, applyCleanMatch } from './rule-match';
import { applyBatchMatch } from './batch-match';
import { classifyMissingSettlement, classifyMissingBankEntry, classifyAmbiguousMatch } from './classify-exception';
import { computePriorityScore, prioritizeExceptions } from './prioritize';
import type { NormalizedRecord, EngineException, ExceptionType } from '../domain/types';
import type { BatchGroup } from './exact-match';

const RUN = 'run-test-001';
const REF_DATE = '2025-03-31T23:59:59.000Z';

function makeRec(overrides: Partial<NormalizedRecord> & { source: NormalizedRecord['source'] }): NormalizedRecord {
  return {
    id: overrides.id ?? 'r1',
    runId: RUN,
    source: overrides.source,
    externalRef: overrides.externalRef ?? 'ext-1',
    paymentRef: overrides.paymentRef ?? 'pay-1',
    settlementRef: overrides.settlementRef ?? 'setl-1',
    orderId: overrides.orderId ?? '',
    utr: overrides.utr ?? 'UTR_1',
    amountPaise: overrides.amountPaise ?? 100000,
    feePaise: overrides.feePaise ?? 0,
    taxPaise: overrides.taxPaise ?? 0,
    netPaise: overrides.netPaise ?? 100000,
    occurredAt: overrides.occurredAt ?? new Date('2025-01-15'),
    settledAt: overrides.settledAt ?? new Date('2025-01-17'),
    rawJson: overrides.rawJson ?? '{}',
  };
}

// ============================================================
// Rule: fee-tax
// ============================================================
describe('applyFeeTaxRule', () => {
  it('produces EXPLAINED when gross matches and bank gets net', () => {
    const m = makeRec({ id: 'm1', source: 'merchant', amountPaise: 100000, feePaise: 0, taxPaise: 0, netPaise: 100000 });
    const rzp = makeRec({ id: 'rz1', source: 'razorpay', amountPaise: 100000, feePaise: 2000, taxPaise: 360, netPaise: 97640 });
    const bank = makeRec({ id: 'b1', source: 'bank', amountPaise: 97640, feePaise: 0, taxPaise: 0, netPaise: 97640 });
    const outcome = applyFeeTaxRule(RUN, m, rzp, bank);
    expect(outcome.type).toBe('decision');
    if (outcome.type === 'decision') {
      expect(outcome.decision.status).toBe('EXPLAINED');
      expect(outcome.decision.matchType).toBe('rule-fee-tax');
      expect(outcome.decision.differencePaise).toBe(2360);
      expect(outcome.decision.evidence).toContain('fee');
    }
  });

  it('returns unresolved when gross amounts do not match — NEGATIVE TEST', () => {
    const m = makeRec({ id: 'm1', source: 'merchant', amountPaise: 100000, netPaise: 100000 });
    const rzp = makeRec({ id: 'rz1', source: 'razorpay', amountPaise: 95000, feePaise: 1900, taxPaise: 342, netPaise: 92758 });
    const bank = makeRec({ id: 'b1', source: 'bank', amountPaise: 92758, netPaise: 92758 });
    const outcome = applyFeeTaxRule(RUN, m, rzp, bank);
    expect(outcome.type).toBe('unresolved');
  });

  it('returns unresolved when bank does not receive net — NEGATIVE TEST', () => {
    const m = makeRec({ id: 'm1', source: 'merchant', amountPaise: 100000, netPaise: 100000 });
    const rzp = makeRec({ id: 'rz1', source: 'razorpay', amountPaise: 100000, feePaise: 2000, taxPaise: 360, netPaise: 97640 });
    const bank = makeRec({ id: 'b1', source: 'bank', amountPaise: 99999, netPaise: 99999 }); // wrong amount
    const outcome = applyFeeTaxRule(RUN, m, rzp, bank);
    expect(outcome.type).toBe('unresolved');
  });

  it('returns unresolved when net arithmetic is inconsistent — NEGATIVE TEST', () => {
    // This tests the net integrity check in applyFeeTaxRule
    const m = makeRec({ id: 'm1', source: 'merchant', amountPaise: 100000, netPaise: 100000 });
    const rzp = makeRec({ id: 'rz1', source: 'razorpay', amountPaise: 100000, feePaise: 2000, taxPaise: 360, netPaise: 99000 }); // net doesn't match
    const bank = makeRec({ id: 'b1', source: 'bank', amountPaise: 99000, netPaise: 99000 });
    // netIntegrity fails: 100000 - 2000 - 360 = 97640 != 99000
    const outcome = applyFeeTaxRule(RUN, m, rzp, bank);
    expect(outcome.type).toBe('unresolved');
  });
});

// ============================================================
// Rule: timing
// ============================================================
describe('applyTimingRule', () => {
  it('produces MATCHED when settlement is delayed but within tolerance', () => {
    const merchant = makeRec({ id: 'm1', source: 'merchant' });
    const razorpay = makeRec({ id: 'rz1', source: 'razorpay', utr: 'UTR_1', settledAt: new Date('2025-01-15') });
    const bank = makeRec({ id: 'b1', source: 'bank', utr: 'UTR_1', occurredAt: new Date('2025-01-19') }); // 4-day delay
    const outcome = applyTimingRule(RUN, merchant, razorpay, bank);
    expect(outcome.type).toBe('decision');
    if (outcome.type === 'decision') {
      expect(outcome.decision.status).toBe('MATCHED');
      expect(outcome.decision.matchType).toBe('rule-timing');
      expect(outcome.decision.evidence).toContain('UTR_1');
      expect(outcome.decision.evidence).toContain('delayed');
    }
  });

  it('returns unresolved when delay exceeds tolerance', () => {
    const merchant = makeRec({ id: 'm1', source: 'merchant' });
    const razorpay = makeRec({ id: 'rz1', source: 'razorpay', utr: 'UTR_1', settledAt: new Date('2025-01-01') });
    const bank = makeRec({ id: 'b1', source: 'bank', utr: 'UTR_1', occurredAt: new Date('2025-02-15') }); // 45-day delay
    const outcome = applyTimingRule(RUN, merchant, razorpay, bank);
    expect(outcome.type).toBe('unresolved');
  });
});

// ============================================================
// Rule: clean match
// ============================================================
describe('applyCleanMatch', () => {
  it('produces MATCHED when no fee and all amounts agree', () => {
    const m = makeRec({ id: 'm1', source: 'merchant', amountPaise: 100000, netPaise: 100000 });
    const rzp = makeRec({ id: 'rz1', source: 'razorpay', amountPaise: 100000, feePaise: 0, taxPaise: 0, netPaise: 100000, paymentRef: 'pay-1' });
    const bank = makeRec({ id: 'b1', source: 'bank', amountPaise: 100000, netPaise: 100000 });
    const outcome = applyCleanMatch(RUN, m, rzp, bank);
    expect(outcome.type).toBe('decision');
    if (outcome.type === 'decision') {
      expect(outcome.decision.status).toBe('MATCHED');
      expect(outcome.decision.differencePaise).toBe(0);
    }
  });

  it('produces EXPLAINED when fee present and amounts reconcile', () => {
    const m = makeRec({ id: 'm1', source: 'merchant', amountPaise: 100000, netPaise: 100000 });
    const rzp = makeRec({ id: 'rz1', source: 'razorpay', amountPaise: 100000, feePaise: 2000, taxPaise: 360, netPaise: 97640, paymentRef: 'pay-1' });
    const bank = makeRec({ id: 'b1', source: 'bank', amountPaise: 97640, netPaise: 97640 });
    const outcome = applyCleanMatch(RUN, m, rzp, bank);
    expect(outcome.type).toBe('decision');
    if (outcome.type === 'decision') {
      expect(outcome.decision.status).toBe('EXPLAINED');
    }
  });

  it('returns unresolved when merchant gross != razorpay gross — NEGATIVE TEST', () => {
    const m = makeRec({ id: 'm1', source: 'merchant', amountPaise: 100000, netPaise: 100000 });
    const rzp = makeRec({ id: 'rz1', source: 'razorpay', amountPaise: 99000, feePaise: 0, taxPaise: 0, netPaise: 99000 });
    const bank = makeRec({ id: 'b1', source: 'bank', amountPaise: 99000, netPaise: 99000 });
    const outcome = applyCleanMatch(RUN, m, rzp, bank);
    expect(outcome.type).toBe('unresolved');
  });
});

// ============================================================
// Batch match
// ============================================================
describe('applyBatchMatch', () => {
  function makeRzp(id: string, netPaise: number, externalRef: string): NormalizedRecord {
    return makeRec({ id, source: 'razorpay', netPaise, amountPaise: netPaise, externalRef, settlementRef: 'setl_B1', utr: 'UTR_BATCH' });
  }

  it('produces MATCHED when grouping + total both verify', () => {
    const rz1 = makeRzp('rz1', 50000, 'pay_a');
    const rz2 = makeRzp('rz2', 47000, 'pay_b');
    const bank = makeRec({ id: 'b1', source: 'bank', utr: 'UTR_BATCH', amountPaise: 97000, netPaise: 97000 });
    const group: BatchGroup = { settlementId: 'setl_B1', utr: 'UTR_BATCH', razorpayRecords: [rz1, rz2] };
    const outcome = applyBatchMatch(RUN, group, [bank], new Set());
    expect(outcome.type).toBe('matched');
    if (outcome.type === 'matched') {
      expect(outcome.decision.matchType).toBe('batch-settlement');
      expect(outcome.decision.evidence).toContain('UTR_BATCH');
    }
  });

  it('returns unresolved when financial total does not match — NEGATIVE TEST', () => {
    const rz1 = makeRzp('rz1', 50000, 'pay_a');
    const rz2 = makeRzp('rz2', 47000, 'pay_b');
    const bank = makeRec({ id: 'b1', source: 'bank', utr: 'UTR_BATCH', amountPaise: 99999, netPaise: 99999 }); // wrong total
    const group: BatchGroup = { settlementId: 'setl_B1', utr: 'UTR_BATCH', razorpayRecords: [rz1, rz2] };
    const outcome = applyBatchMatch(RUN, group, [bank], new Set());
    expect(outcome.type).toBe('unresolved');
    if (outcome.type === 'unresolved') expect(outcome.reason).toContain('total mismatch');
  });

  it('returns unresolved when no bank record with matching UTR — incomplete batch — NEGATIVE TEST', () => {
    const rz1 = makeRzp('rz1', 50000, 'pay_a');
    const rz2 = makeRzp('rz2', 47000, 'pay_b');
    const bank = makeRec({ id: 'b1', source: 'bank', utr: 'UTR_DIFFERENT', amountPaise: 97000, netPaise: 97000 });
    const group: BatchGroup = { settlementId: 'setl_B1', utr: 'UTR_BATCH', razorpayRecords: [rz1, rz2] };
    const outcome = applyBatchMatch(RUN, group, [bank], new Set());
    expect(outcome.type).toBe('unresolved');
    if (outcome.type === 'unresolved') expect(outcome.reason).toContain('No bank record');
  });

  it('does NOT match by amount alone without UTR evidence — NEGATIVE TEST', () => {
    const rz1 = makeRzp('rz1', 50000, 'pay_a');
    const rz2 = makeRzp('rz2', 47000, 'pay_b');
    // Bank has same amount but different UTR
    const bank = makeRec({ id: 'b1', source: 'bank', utr: 'UTR_WRONG', amountPaise: 97000, netPaise: 97000 });
    const group: BatchGroup = { settlementId: 'setl_B1', utr: 'UTR_BATCH', razorpayRecords: [rz1, rz2] };
    const outcome = applyBatchMatch(RUN, group, [bank], new Set());
    expect(outcome.type).toBe('unresolved');
  });
});

// ============================================================
// Exception classification
// ============================================================
describe('exception classification', () => {
  it('classifies missing settlement correctly', () => {
    const merchant = makeRec({ id: 'm1', source: 'merchant', paymentRef: 'pay_x' });
    const exc = classifyMissingSettlement(RUN, merchant);
    expect(exc.type).toBe('MISSING_SETTLEMENT');
    expect(exc.severity).toBe('high');
    expect(exc.description).toContain('pay_x');
    expect(exc.sourceRecordIds).toContain('m1');
  });

  it('classifies missing bank entry correctly', () => {
    const merchant = makeRec({ id: 'm1', source: 'merchant' });
    const razorpay = makeRec({ id: 'rz1', source: 'razorpay', utr: 'UTR_1' });
    const exc = classifyMissingBankEntry(RUN, merchant, razorpay);
    expect(exc.type).toBe('MISSING_BANK_ENTRY');
    expect(exc.severity).toBe('medium');
    expect(exc.description).toContain('UTR_1');
  });

  it('classifies ambiguous match correctly', () => {
    const rz1 = makeRec({ id: 'rz1', source: 'razorpay' });
    const rz2 = makeRec({ id: 'rz2', source: 'razorpay' });
    const exc = classifyAmbiguousMatch(RUN, [rz1, rz2], 'pay_shared');
    expect(exc.type).toBe('AMBIGUOUS_MATCH');
    expect(exc.description).toContain('pay_shared');
  });
});

// ============================================================
// Priority scoring
// ============================================================
describe('computePriorityScore', () => {
  function makeExc(type: ExceptionType, amountPaise: number, createdAt: string): EngineException {
    return { id: 'e1', runId: RUN, sourceRecordIds: ['r1'], type, severity: 'medium', amountPaise, description: '', priorityScore: 0, createdAt };
  }

  it('MISSING_SETTLEMENT scores higher than MISSING_BANK_ENTRY for same amount', () => {
    const ms = makeExc('MISSING_SETTLEMENT', 100000, '2025-01-01T00:00:00Z');
    const mb = makeExc('MISSING_BANK_ENTRY', 100000, '2025-01-01T00:00:00Z');
    expect(computePriorityScore(ms, REF_DATE)).toBeGreaterThan(computePriorityScore(mb, REF_DATE));
  });

  it('AMOUNT_MISMATCH scores higher than MISSING_BANK_ENTRY for same amount', () => {
    const am = makeExc('AMOUNT_MISMATCH', 100000, '2025-01-01T00:00:00Z');
    const mb = makeExc('MISSING_BANK_ENTRY', 100000, '2025-01-01T00:00:00Z');
    expect(computePriorityScore(am, REF_DATE)).toBeGreaterThan(computePriorityScore(mb, REF_DATE));
  });

  it('same type + same amount = same score (determinism)', () => {
    const e1 = makeExc('MISSING_SETTLEMENT', 50000, '2025-02-01T00:00:00Z');
    const e2 = makeExc('MISSING_SETTLEMENT', 50000, '2025-02-01T00:00:00Z');
    expect(computePriorityScore(e1, REF_DATE)).toBe(computePriorityScore(e2, REF_DATE));
  });

  it('older exceptions score higher than newer ones (age factor)', () => {
    const older = makeExc('MISSING_BANK_ENTRY', 50000, '2025-01-01T00:00:00Z');
    const newer = makeExc('MISSING_BANK_ENTRY', 50000, '2025-03-01T00:00:00Z');
    expect(computePriorityScore(older, REF_DATE)).toBeGreaterThan(computePriorityScore(newer, REF_DATE));
  });

  it('prioritizeExceptions returns sorted by descending score', () => {
    const low = makeExc('UNSUPPORTED_CASE', 1000, '2025-03-30T00:00:00Z');
    const high = makeExc('MISSING_SETTLEMENT', 500000, '2025-01-01T00:00:00Z');
    const med = makeExc('AMOUNT_MISMATCH', 50000, '2025-02-01T00:00:00Z');
    const sorted = prioritizeExceptions([low, med, high], REF_DATE);
    expect(sorted[0].priorityScore).toBeGreaterThanOrEqual(sorted[1].priorityScore);
    expect(sorted[1].priorityScore).toBeGreaterThanOrEqual(sorted[2].priorityScore);
  });
});
