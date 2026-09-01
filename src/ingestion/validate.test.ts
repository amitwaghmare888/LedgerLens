/**
 * Tests — Row Validation
 *
 * Verifies:
 * - Valid rows → NormalizedRecord (never blocked)
 * - Invalid amount → RowError (never reaches engine)
 * - Invalid date → RowError
 * - Invalid type → RowError
 * - Partial file (mix of valid/invalid)
 */
import { describe, it, expect } from 'vitest';
import { validateRows, parsePaise, parseDate } from './validate';
import type { ParsedRow } from './types';

// ── parsePaise ────────────────────────────────────────────────
describe('parsePaise', () => {
  it('accepts valid integer strings', () => {
    expect(parsePaise('10000', 'amount').value).toBe(10000);
    expect(parsePaise('0', 'amount').value).toBe(0);
    expect(parsePaise('-500', 'amount').value).toBe(-500);
  });

  it('rejects "₹abc"', () => {
    expect(parsePaise('₹abc', 'amount').error).toBeTruthy();
  });

  it('rejects decimal "12.345"', () => {
    expect(parsePaise('12.345', 'amount').error).toBeTruthy();
  });

  it('rejects empty string', () => {
    expect(parsePaise('', 'amount').error).toBeTruthy();
  });

  it('strips ₹ and commas from valid integer', () => {
    expect(parsePaise('₹10,000', 'amount').value).toBe(10000);
  });
});

// ── parseDate ─────────────────────────────────────────────────
describe('parseDate', () => {
  it('accepts ISO date', () => {
    const d = parseDate('2024-01-15', 'date');
    expect(d.error).toBeUndefined();
    expect(d.value.getFullYear()).toBe(2024);
  });

  it('accepts DD/MM/YYYY', () => {
    const d = parseDate('15/01/2024', 'date');
    expect(d.error).toBeUndefined();
    expect(d.value.getMonth()).toBe(0); // January
  });

  it('rejects empty', () => {
    expect(parseDate('', 'date').error).toBeTruthy();
  });

  it('rejects invalid date', () => {
    expect(parseDate('not-a-date', 'date').error).toBeTruthy();
  });
});

// ── validateRows — merchant ───────────────────────────────────
describe('validateRows merchant', () => {
  const validMerchantRow: ParsedRow = {
    merchantTxnId: 'TXN001', orderRef: 'ORD001', paymentRef: 'pay_001',
    customerId: 'CUST1', type: 'sale', amountPaise: '10000',
    date: '2024-01-15', description: 'Test',
  };

  it('accepts valid row → NormalizedRecord', () => {
    const { valid, invalid } = validateRows([validMerchantRow], 'merchant', 'run_test');
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
    expect(valid[0].amountPaise).toBe(10000);
    expect(valid[0].source).toBe('merchant');
  });

  it('rejects invalid amount → RowError, not in engine', () => {
    const row = { ...validMerchantRow, amountPaise: '₹abc' };
    const { valid, invalid } = validateRows([row], 'merchant', 'run_test');
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].rowNumber).toBe(2);
    expect(invalid[0].errors[0]).toContain('amountPaise');
  });

  it('rejects invalid date → RowError', () => {
    const row = { ...validMerchantRow, date: 'not-a-date' };
    const { valid, invalid } = validateRows([row], 'merchant', 'run_test');
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });

  it('rejects invalid type → RowError', () => {
    const row = { ...validMerchantRow, type: 'purchase' }; // not sale/refund/adjustment
    const { valid, invalid } = validateRows([row], 'merchant', 'run_test');
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });

  it('handles partial file — valid and invalid rows separated', () => {
    const validRow = validMerchantRow;
    const invalidRow = { ...validMerchantRow, amountPaise: 'bad', merchantTxnId: 'TXN002' };
    const { valid, invalid } = validateRows([validRow, invalidRow], 'merchant', 'run_test');
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].rowNumber).toBe(3); // row 2 is invalid (2+1=3 since firstDataRow=2)
  });
});

// ── validateRows — razorpay ───────────────────────────────────
describe('validateRows razorpay', () => {
  const validRzRow: ParsedRow = {
    paymentId: 'pay_001', orderId: 'order_001', settlementId: 'setl_001',
    status: 'captured', amountPaise: '10000', feePaise: '236',
    taxPaise: '42', netPaise: '9722', createdAt: '2024-01-15',
    settledAt: '2024-01-17', utr: 'UTR001',
  };

  it('accepts valid razorpay row', () => {
    const { valid, invalid } = validateRows([validRzRow], 'razorpay', 'run_test');
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
    expect(valid[0].feePaise).toBe(236);
    expect(valid[0].netPaise).toBe(9722);
  });

  it('rejects invalid status', () => {
    const row = { ...validRzRow, status: 'pending' };
    const { valid, invalid } = validateRows([row], 'razorpay', 'run_test');
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });

  it('rejects arithmetic failure (net != amount - fee - tax)', () => {
    // net should be 10000-236-42=9722, but we give 9999
    const row = { ...validRzRow, netPaise: '9999' };
    const { valid, invalid } = validateRows([row], 'razorpay', 'run_test');
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });
});

// ── validateRows — bank ───────────────────────────────────────
describe('validateRows bank', () => {
  const validBankRow: ParsedRow = {
    bankRef: 'BANK001', type: 'credit', amountPaise: '9722',
    date: '2024-01-17', valueDate: '2024-01-17', utr: 'UTR001', narration: 'Settlement',
  };

  it('accepts valid bank row', () => {
    const { valid, invalid } = validateRows([validBankRow], 'bank', 'run_test');
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
    expect(valid[0].source).toBe('bank');
  });

  it('rejects invalid type (not credit/debit)', () => {
    const row = { ...validBankRow, type: 'transfer' };
    const { valid, invalid } = validateRows([row], 'bank', 'run_test');
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });
});
