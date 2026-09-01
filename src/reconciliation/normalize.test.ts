/**
 * Tests: normalize.ts
 * Covers: valid input, Zod rejection, net integrity check.
 */
import { describe, it, expect } from 'vitest';
import { normalizeMerchant, normalizeRazorpay, normalizeBank, NormalizationError, normalizeFromDataset } from './normalize';
import { generateDataset } from '../dataset/generator';

const RUN_ID = 'test-run-001';

describe('normalizeMerchant', () => {
  it('produces a valid NormalizedRecord for a clean merchant', () => {
    const raw = { merchantTxnId: 'mtxn_abc', orderRef: 'ord_abc', paymentRef: 'pay_abc', customerId: 'cust_1', type: 'sale', amountPaise: 100000, date: new Date('2025-01-15'), description: 'Test' };
    const r = normalizeMerchant(raw, RUN_ID);
    expect(r.source).toBe('merchant');
    expect(r.amountPaise).toBe(100000);
    expect(r.netPaise).toBe(100000);
    expect(r.feePaise).toBe(0);
    expect(r.paymentRef).toBe('pay_abc');
    expect(r.utr).toBe('');
    expect(r.settlementRef).toBe('');
    expect(r.rawJson).toContain('mtxn_abc');
  });

  it('rejects merchant with missing paymentRef', () => {
    const raw = { merchantTxnId: 'x', orderRef: 'o', paymentRef: '', customerId: 'c', type: 'sale', amountPaise: 100, date: new Date(), description: '' };
    expect(() => normalizeMerchant(raw, RUN_ID)).toThrow(NormalizationError);
  });

  it('rejects merchant with fractional amountPaise', () => {
    const raw = { merchantTxnId: 'x', orderRef: 'o', paymentRef: 'p', customerId: 'c', type: 'sale', amountPaise: 100.5, date: new Date(), description: '' };
    expect(() => normalizeMerchant(raw, RUN_ID)).toThrow(NormalizationError);
  });

  it('rejects merchant with NaN amountPaise', () => {
    const raw = { merchantTxnId: 'x', orderRef: 'o', paymentRef: 'p', customerId: 'c', type: 'sale', amountPaise: NaN, date: new Date(), description: '' };
    expect(() => normalizeMerchant(raw, RUN_ID)).toThrow(NormalizationError);
  });
});

describe('normalizeRazorpay', () => {
  it('produces a valid NormalizedRecord for clean razorpay', () => {
    const raw = { paymentId: 'pay_1', orderId: 'ord_1', settlementId: 'setl_1', status: 'captured', amountPaise: 100000, feePaise: 2000, taxPaise: 360, netPaise: 97640, createdAt: new Date('2025-01-15'), settledAt: new Date('2025-01-17'), utr: 'UTIB123456' };
    const r = normalizeRazorpay(raw, RUN_ID);
    expect(r.source).toBe('razorpay');
    expect(r.netPaise).toBe(97640);
    expect(r.utr).toBe('UTIB123456');
    expect(r.settlementRef).toBe('setl_1');
  });

  it('rejects when net != amount - fee - tax', () => {
    const raw = { paymentId: 'pay_1', orderId: 'ord_1', settlementId: 'setl_1', status: 'captured', amountPaise: 100000, feePaise: 2000, taxPaise: 360, netPaise: 99999, createdAt: new Date(), settledAt: new Date(), utr: 'UTR1' };
    expect(() => normalizeRazorpay(raw, RUN_ID)).toThrow(NormalizationError);
    expect(() => normalizeRazorpay(raw, RUN_ID)).toThrow('netPaise');
  });

  it('rejects negative feePaise', () => {
    const raw = { paymentId: 'pay_1', orderId: 'ord_1', settlementId: 'setl_1', status: 'captured', amountPaise: 100000, feePaise: -100, taxPaise: 0, netPaise: 100100, createdAt: new Date(), settledAt: new Date(), utr: 'UTR1' };
    expect(() => normalizeRazorpay(raw, RUN_ID)).toThrow(NormalizationError);
  });
});

describe('normalizeBank', () => {
  it('produces a valid NormalizedRecord for a bank credit', () => {
    const raw = { bankRef: 'bnk_1', type: 'credit', amountPaise: 97640, date: new Date('2025-01-17'), valueDate: new Date('2025-01-17'), utr: 'UTIB123456', narration: 'NEFT-RAZORPAY' };
    const r = normalizeBank(raw, RUN_ID);
    expect(r.source).toBe('bank');
    expect(r.amountPaise).toBe(97640);
    expect(r.utr).toBe('UTIB123456');
    expect(r.paymentRef).toBe('');
  });

  it('rejects zero amountPaise for bank', () => {
    const raw = { bankRef: 'bnk_1', type: 'credit', amountPaise: 0, date: new Date(), valueDate: new Date(), utr: 'UTR1', narration: '' };
    expect(() => normalizeBank(raw, RUN_ID)).toThrow(NormalizationError);
  });

  it('rejects missing UTR', () => {
    const raw = { bankRef: 'bnk_1', type: 'credit', amountPaise: 1000, date: new Date(), valueDate: new Date(), utr: '', narration: '' };
    expect(() => normalizeBank(raw, RUN_ID)).toThrow(NormalizationError);
  });
});

describe('normalizeFromDataset', () => {
  it('normalizes all 75 cases without error', () => {
    const dataset = generateDataset(42);
    const records = normalizeFromDataset(dataset.cases, RUN_ID);
    expect(records.length).toBe(dataset.totalRecords);
    expect(records.every((r) => r.runId === RUN_ID)).toBe(true);
    expect(records.every((r) => ['merchant', 'razorpay', 'bank'].includes(r.source))).toBe(true);
  });

  it('all merchant records have empty UTR and settlementRef', () => {
    const dataset = generateDataset(42);
    const records = normalizeFromDataset(dataset.cases, RUN_ID);
    const merchants = records.filter((r) => r.source === 'merchant');
    expect(merchants.every((r) => r.utr === '' && r.settlementRef === '')).toBe(true);
  });

  it('all bank records have empty paymentRef and settlementRef', () => {
    const dataset = generateDataset(42);
    const records = normalizeFromDataset(dataset.cases, RUN_ID);
    const banks = records.filter((r) => r.source === 'bank');
    expect(banks.every((r) => r.paymentRef === '' && r.settlementRef === '')).toBe(true);
  });
});
