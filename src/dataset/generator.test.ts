import { describe, it, expect } from 'vitest';
import { generateDataset } from '../dataset/generator';
import { validateSyntheticCase, validateBatchTotal } from '../domain/invariants';
import { isValidPaise } from '../lib/money';

describe('synthetic dataset', () => {
  const dataset = generateDataset(42);

  describe('determinism', () => {
    it('same seed produces same dataset', () => {
      const d1 = generateDataset(42);
      const d2 = generateDataset(42);
      expect(d1.totalRecords).toBe(d2.totalRecords);
      expect(d1.cases.length).toBe(d2.cases.length);
      // Compare a few record IDs
      for (let i = 0; i < d1.cases.length; i++) {
        expect(d1.cases[i].scenario).toBe(d2.cases[i].scenario);
        if (d1.cases[i].merchantRecords.length > 0) {
          expect(d1.cases[i].merchantRecords[0].merchantTxnId).toBe(
            d2.cases[i].merchantRecords[0].merchantTxnId
          );
          expect(d1.cases[i].merchantRecords[0].amountPaise).toBe(
            d2.cases[i].merchantRecords[0].amountPaise
          );
        }
      }
    });

    it('different seed produces different dataset', () => {
      const d1 = generateDataset(42);
      const d2 = generateDataset(99);
      // Same structure but different data
      expect(d1.cases.length).toBe(d2.cases.length);
      // At least some merchant amounts should differ
      const amounts1 = d1.cases
        .flatMap((c) => c.merchantRecords)
        .map((m) => m.amountPaise);
      const amounts2 = d2.cases
        .flatMap((c) => c.merchantRecords)
        .map((m) => m.amountPaise);
      // Not all amounts can be the same
      const allSame = amounts1.every((a, i) => a === amounts2[i]);
      expect(allSame).toBe(false);
    });
  });

  describe('source distribution', () => {
    it('generates approximately 150+ total records', () => {
      expect(dataset.totalRecords).toBeGreaterThanOrEqual(150);
    });

    it('has records from all three sources', () => {
      expect(dataset.totalMerchantRecords).toBeGreaterThan(0);
      expect(dataset.totalRazorpayRecords).toBeGreaterThan(0);
      expect(dataset.totalBankRecords).toBeGreaterThan(0);
    });

    it('contains all expected scenario types', () => {
      const scenarios = Object.keys(dataset.scenarioDistribution);
      expect(scenarios).toContain('clean-match');
      expect(scenarios).toContain('fee-tax-difference');
      expect(scenarios).toContain('timing-difference');
      expect(scenarios).toContain('refund');
      expect(scenarios).toContain('adjustment');
      expect(scenarios).toContain('batch-settlement');
      expect(scenarios).toContain('missing-merchant-record');
      expect(scenarios).toContain('missing-bank-record');
      expect(scenarios).toContain('adversarial-trap');
    });
  });

  describe('financial invariants', () => {
    it('all cases pass validation', () => {
      for (const c of dataset.cases) {
        const result = validateSyntheticCase(c);
        if (!result.valid) {
          // Show which case failed for easier debugging
          throw new Error(
            `Case ${c.scenario} failed validation: ${result.errors.join(', ')}`
          );
        }
        expect(result.valid).toBe(true);
      }
    });

    it('all monetary values are valid paise', () => {
      for (const c of dataset.cases) {
        for (const m of c.merchantRecords) {
          expect(isValidPaise(m.amountPaise)).toBe(true);
        }
        for (const rz of c.razorpayRecords) {
          expect(isValidPaise(rz.amountPaise)).toBe(true);
          expect(isValidPaise(rz.feePaise)).toBe(true);
          expect(isValidPaise(rz.taxPaise)).toBe(true);
          expect(isValidPaise(rz.netPaise)).toBe(true);
        }
        for (const b of c.bankRecords) {
          expect(isValidPaise(b.amountPaise)).toBe(true);
        }
      }
    });

    it('Razorpay net = amount - fee - tax for all records', () => {
      for (const c of dataset.cases) {
        for (const rz of c.razorpayRecords) {
          expect(rz.netPaise).toBe(rz.amountPaise - rz.feePaise - rz.taxPaise);
        }
      }
    });
  });

  describe('scenario-specific checks', () => {
    it('clean-match cases have exactly 1 record per source', () => {
      const cleanCases = dataset.cases.filter((c) => c.scenario === 'clean-match');
      for (const c of cleanCases) {
        expect(c.merchantRecords.length).toBe(1);
        expect(c.razorpayRecords.length).toBe(1);
        expect(c.bankRecords.length).toBe(1);
      }
    });

    it('refund cases have sale + refund merchant records', () => {
      const refundCases = dataset.cases.filter((c) => c.scenario === 'refund');
      for (const c of refundCases) {
        expect(c.merchantRecords.length).toBe(2);
        const types = c.merchantRecords.map((m) => m.type);
        expect(types).toContain('sale');
        expect(types).toContain('refund');
      }
    });

    it('refund does not exceed original amount', () => {
      const refundCases = dataset.cases.filter((c) => c.scenario === 'refund');
      for (const c of refundCases) {
        const sale = c.merchantRecords.find((m) => m.type === 'sale')!;
        const refund = c.merchantRecords.find((m) => m.type === 'refund')!;
        expect(refund.amountPaise).toBeLessThanOrEqual(sale.amountPaise);
      }
    });

    it('missing-merchant cases have no merchant records', () => {
      const cases = dataset.cases.filter((c) => c.scenario === 'missing-merchant-record');
      for (const c of cases) {
        expect(c.merchantRecords.length).toBe(0);
        expect(c.razorpayRecords.length).toBeGreaterThan(0);
        expect(c.bankRecords.length).toBeGreaterThan(0);
      }
    });

    it('missing-bank cases have no bank records', () => {
      const cases = dataset.cases.filter((c) => c.scenario === 'missing-bank-record');
      for (const c of cases) {
        expect(c.merchantRecords.length).toBeGreaterThan(0);
        expect(c.razorpayRecords.length).toBeGreaterThan(0);
        expect(c.bankRecords.length).toBe(0);
      }
    });

    it('batch settlements have consistent bank total', () => {
      const batchCases = dataset.cases.filter((c) => c.scenario === 'batch-settlement');
      for (const c of batchCases) {
        expect(c.bankRecords.length).toBe(1);
        const result = validateBatchTotal(c.razorpayRecords, c.bankRecords[0]);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('adversarial traps', () => {
    it('trap cases are flagged in ground truth', () => {
      const traps = dataset.cases.filter((c) => c.scenario === 'adversarial-trap');
      expect(traps.length).toBeGreaterThan(0);
      for (const t of traps) {
        expect(t.groundTruth.isTrap).toBe(true);
      }
    });

    it('non-trap cases are not flagged', () => {
      const nonTraps = dataset.cases.filter((c) => c.scenario !== 'adversarial-trap');
      for (const c of nonTraps) {
        expect(c.groundTruth.isTrap).toBe(false);
      }
    });

    it('traps have two distinct transactions with close amounts', () => {
      const traps = dataset.cases.filter((c) => c.scenario === 'adversarial-trap');
      for (const t of traps) {
        expect(t.merchantRecords.length).toBe(2);
        expect(t.razorpayRecords.length).toBe(2);
        expect(t.bankRecords.length).toBe(2);
        // Amounts should be close
        const diff = Math.abs(
          t.merchantRecords[0].amountPaise - t.merchantRecords[1].amountPaise
        );
        expect(diff).toBeLessThanOrEqual(100); // Within 1 INR
      }
    });
  });

  describe('ground truth', () => {
    it('every case has ground truth', () => {
      for (const c of dataset.cases) {
        expect(c.groundTruth).toBeDefined();
        expect(c.groundTruth.scenarioType).toBe(c.scenario);
        expect(c.groundTruth.expectedMatchGroup.length).toBeGreaterThan(0);
        expect(c.groundTruth.expectedOutcome.length).toBeGreaterThan(0);
      }
    });

    it('ground truth match groups reference existing record IDs', () => {
      for (const c of dataset.cases) {
        const allIds = new Set([
          ...c.merchantRecords.map((m) => m.merchantTxnId),
          ...c.razorpayRecords.map((r) => r.paymentId),
          ...c.bankRecords.map((b) => b.bankRef),
        ]);
        for (const id of c.groundTruth.expectedMatchGroup) {
          expect(allIds.has(id)).toBe(true);
        }
      }
    });
  });

  describe('bank UTR consistency', () => {
    it('every bank record narration contains the same UTR as its utr field', () => {
      for (const c of dataset.cases) {
        for (const b of c.bankRecords) {
          if (b.narration.includes('NEFT-')) {
            expect(b.narration).toContain(b.utr);
          }
        }
      }
    });

    it('bank UTR field is never empty for records with narrations', () => {
      for (const c of dataset.cases) {
        for (const b of c.bankRecords) {
          expect(b.utr.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('batch total arithmetic', () => {
    it('batch bank amount equals sum of individual net settlements using addPaise', () => {
      const batchCases = dataset.cases.filter((c) => c.scenario === 'batch-settlement');
      for (const c of batchCases) {
        let total = 0;
        for (const rz of c.razorpayRecords) {
          total += rz.netPaise; // raw sum for independent check
        }
        expect(c.bankRecords[0].amountPaise).toBe(total);
      }
    });
  });
});
