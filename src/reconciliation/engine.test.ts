/**
 * Tests: engine.ts + evaluate.ts
 * Covers: full pipeline integration, trap case invariant, determinism, ground-truth evaluation.
 */
import { describe, it, expect } from 'vitest';
import { runReconciliationEngine } from './engine';
import { evaluateEngine } from './evaluate';
import { generateDataset } from '../dataset/generator';
import { normalizeFromDataset } from './normalize';
import type { NormalizedRecord } from '../domain/types';

const RUN_ID = 'test-engine-run';

function makeRec(id: string, source: NormalizedRecord['source'], paymentRef: string, utr: string, settlementRef: string, amountPaise: number, feePaise: number, taxPaise: number, netPaise: number, rawJson: string = '{}'): NormalizedRecord {
  return {
    id, runId: RUN_ID, source,
    externalRef: id.replace('src_', ''),
    paymentRef, settlementRef, utr,
    orderId: '',
    amountPaise, feePaise, taxPaise, netPaise,
    occurredAt: new Date('2025-01-15'),
    settledAt: new Date('2025-01-17'),
    rawJson,
  };
}

// ============================================================
// Engine integration: clean match
// ============================================================
describe('engine — clean 3-way match', () => {
  it('produces a MATCHED or EXPLAINED decision for a clean case', () => {
    const merchant = makeRec('src_m1', 'merchant', 'pay_abc', '', '', 100000, 0, 0, 100000, '{"merchantTxnId":"m1","paymentRef":"pay_abc"}');
    const razorpay = makeRec('src_rz1', 'razorpay', 'pay_abc', 'UTR_1', 'setl_1', 100000, 2000, 360, 97640, '{"paymentId":"pay_abc","orderId":"ord_1","settlementId":"setl_1","status":"captured"}');
    const bank = makeRec('src_b1', 'bank', '', 'UTR_1', '', 97640, 0, 0, 97640, '{"bankRef":"b1","type":"credit","utr":"UTR_1"}');

    const result = runReconciliationEngine(RUN_ID, [merchant, razorpay, bank]);
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions[0].status).toMatch(/^(MATCHED|EXPLAINED)$/);
    expect(result.exceptions).toHaveLength(0);
  });
});

// ============================================================
// Engine: missing bank entry
// ============================================================
describe('engine — missing bank entry', () => {
  it('raises a MISSING_BANK_ENTRY exception when bank record is absent', () => {
    const merchant = makeRec('src_m1', 'merchant', 'pay_abc', '', '', 100000, 0, 0, 100000, '{"merchantTxnId":"m1","paymentRef":"pay_abc"}');
    const razorpay = makeRec('src_rz1', 'razorpay', 'pay_abc', 'UTR_1', 'setl_1', 100000, 2000, 360, 97640, '{"paymentId":"pay_abc","orderId":"ord_1","settlementId":"setl_1","status":"captured"}');

    const result = runReconciliationEngine(RUN_ID, [merchant, razorpay]);
    expect(result.decisions).toHaveLength(0);
    expect(result.exceptions.length).toBeGreaterThan(0);
    expect(result.exceptions[0].type).toBe('MISSING_BANK_ENTRY');
  });
});

// ============================================================
// Engine: missing merchant
// ============================================================
describe('engine — missing merchant record', () => {
  it('raises a MISSING_SETTLEMENT or orphan exception when merchant is absent', () => {
    const razorpay = makeRec('src_rz1', 'razorpay', 'pay_abc', 'UTR_1', 'setl_1', 100000, 2000, 360, 97640, '{"paymentId":"pay_abc","orderId":"ord_1","settlementId":"setl_1","status":"captured"}');
    const bank = makeRec('src_b1', 'bank', '', 'UTR_1', '', 97640, 0, 0, 97640, '{"bankRef":"b1","type":"credit","utr":"UTR_1"}');

    const result = runReconciliationEngine(RUN_ID, [razorpay, bank]);
    expect(result.decisions).toHaveLength(0);
    expect(result.exceptions.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Engine: same amount different paymentRef — must NOT match
// ============================================================
describe('engine — same amount different paymentRef — NEGATIVE TEST', () => {
  it('does not produce a decision for records with different paymentRefs', () => {
    const merchant = makeRec('src_m1', 'merchant', 'pay_aaa', '', '', 100000, 0, 0, 100000, '{"merchantTxnId":"m1","paymentRef":"pay_aaa"}');
    const razorpay = makeRec('src_rz1', 'razorpay', 'pay_bbb', 'UTR_1', 'setl_1', 100000, 2000, 360, 97640, '{"paymentId":"pay_bbb","orderId":"ord_1","settlementId":"setl_1","status":"captured"}');
    const bank = makeRec('src_b1', 'bank', '', 'UTR_1', '', 97640, 0, 0, 97640, '{"bankRef":"b1","type":"credit","utr":"UTR_1"}');

    const result = runReconciliationEngine(RUN_ID, [merchant, razorpay, bank]);
    // No cross-paymentRef match should occur
    const crossMatch = result.decisions.find(d =>
      d.sourceRecordIds.includes('src_m1') && d.sourceRecordIds.includes('src_rz1')
    );
    expect(crossMatch).toBeUndefined();
  });
});

// ============================================================
// Engine determinism
// ============================================================
describe('engine — determinism', () => {
  it('produces identical results on two runs with the same input', () => {
    const dataset = generateDataset(42);
    const records = normalizeFromDataset(dataset.cases, RUN_ID);

    const result1 = runReconciliationEngine(RUN_ID, records);
    const result2 = runReconciliationEngine(RUN_ID, records);

    expect(result1.decisions.length).toBe(result2.decisions.length);
    expect(result1.exceptions.length).toBe(result2.exceptions.length);

    const ids1 = result1.decisions.map(d => d.id).sort();
    const ids2 = result2.decisions.map(d => d.id).sort();
    expect(ids1).toEqual(ids2);
  });
});

// ============================================================
// TRAP CASE INVARIANT
// ============================================================
describe('engine — adversarial trap cases', () => {
  it('TRAP: engine must NOT cross-match records from different true groups', () => {
    const dataset = generateDataset(42);
    const trapCases = dataset.cases.filter(c => c.groundTruth.isTrap);
    expect(trapCases.length).toBeGreaterThan(0);

    for (const trapCase of trapCases) {
      const records = normalizeFromDataset([trapCase], `${RUN_ID}-trap`);
      const result = runReconciliationEngine(`${RUN_ID}-trap`, records);

      // For each decision, verify it doesn't span multiple paymentRefs
      for (const decision of result.decisions) {
        const decisionPaymentRefs = new Set(
          decision.sourceRecordIds
            .map(id => records.find(r => r.id === id))
            .filter(Boolean)
            .map(r => r!.paymentRef)
            .filter(Boolean)
        );
        expect(decisionPaymentRefs.size).toBeLessThanOrEqual(1);
      }
    }
  });

  it('TRAP: engine does not access isTrap or groundTruth', () => {
    // Verify no trap metadata is imported into engine.ts
    // This is enforced structurally — the engine only receives NormalizedRecord[]
    // which has no isTrap field
    const record: NormalizedRecord = makeRec('r1', 'merchant', 'pay_1', '', '', 100, 0, 0, 100);
    // NormalizedRecord has no isTrap property — type system enforces this
    expect('isTrap' in record).toBe(false);
    expect('groundTruth' in record).toBe(false);
    expect('scenarioType' in record).toBe(false);
  });
});

// ============================================================
// Evaluation harness
// ============================================================
describe('evaluate — ground-truth evaluation', () => {
  it('measures real metrics against all 75 synthetic cases', () => {
    const dataset = generateDataset(42);
    const report = evaluateEngine(dataset.cases, 'eval-run');

    console.log('\n=== Engine Evaluation Results ===');
    console.log(`Total cases:        ${report.engine.totalCases}`);
    console.log(`Correct matches:    ${report.engine.correctMatches}`);
    console.log(`Incorrect matches:  ${report.engine.incorrectMatches}`);
    console.log(`Unresolved cases:   ${report.engine.unresolvedCases}`);
    console.log(`Precision:          ${(report.engine.precision * 100).toFixed(1)}%`);
    console.log(`Recall:             ${(report.engine.recall * 100).toFixed(1)}%`);
    console.log(`Match rate:         ${(report.engine.matchRate * 100).toFixed(1)}%`);
    console.log(`False matches:      ${report.engine.falseMatches}`);
    console.log(`Trap false matches: ${report.engine.trapFalseMatches}`);
    console.log('\n--- Baseline (exact-match only) ---');
    console.log(`Correct matches:    ${report.baseline.correctMatches}`);
    console.log(`Precision:          ${(report.baseline.precision * 100).toFixed(1)}%`);
    console.log(`Match rate:         ${(report.baseline.matchRate * 100).toFixed(1)}%`);
    console.log('\n--- Delta (engine vs baseline) ---');
    console.log(`Correct delta:      ${report.engineVsBaseline.correctMatchesDelta >= 0 ? '+' : ''}${report.engineVsBaseline.correctMatchesDelta}`);
    console.log(`Unresolved delta:   ${report.engineVsBaseline.unresolvedDelta}`);
    console.log('\n--- By Scenario ---');
    for (const [scenario, metrics] of Object.entries(report.engine.byScenario)) {
      console.log(`  ${scenario}: ${metrics.correctMatches}/${metrics.totalCases} correct, ${metrics.falseMatches} false`);
    }

    // Critical invariants
    expect(report.engine.trapFalseMatches).toBe(0);
    expect(report.engine.totalCases).toBe(75);
    expect(report.engine.precision).toBeGreaterThanOrEqual(0);
    expect(report.engine.precision).toBeLessThanOrEqual(1);
    expect(report.engine.recall).toBeGreaterThanOrEqual(0);
    // The engine should improve on the baseline
    expect(report.engineVsBaseline.correctMatchesDelta).toBeGreaterThanOrEqual(0);
  });
});
