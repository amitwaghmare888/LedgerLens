/**
 * Tests — Column Mapping
 */
import { describe, it, expect } from 'vitest';
import { mapColumns, applyMapping } from './column-map';

describe('mapColumns — merchant', () => {
  it('maps exact headers', () => {
    const r = mapColumns(['merchantTxnId', 'orderRef', 'paymentRef', 'customerId', 'type', 'amountPaise', 'date', 'description'], 'merchant');
    expect(r.missingRequired).toHaveLength(0);
    expect(r.mappedFields['merchantTxnId']).toBe('merchantTxnId');
  });

  it('maps case-insensitive alias: "Payment ID" → paymentRef', () => {
    const r = mapColumns(['merchantTxnId', 'orderRef', 'Payment ID', 'customerId', 'type', 'amountPaise', 'date'], 'merchant');
    expect(r.mappedFields['Payment ID']).toBe('paymentRef');
    expect(r.missingRequired).toHaveLength(0);
  });

  it('maps underscore alias: "merchant_txn_id" → merchantTxnId', () => {
    const r = mapColumns(['merchant_txn_id', 'order_ref', 'payment_ref', 'customer_id', 'type', 'amount_paise', 'date'], 'merchant');
    expect(r.mappedFields['merchant_txn_id']).toBe('merchantTxnId');
    expect(r.missingRequired).toHaveLength(0);
  });

  it('reports missing required fields', () => {
    const r = mapColumns(['merchantTxnId', 'orderRef'], 'merchant');
    expect(r.missingRequired).toContain('paymentRef');
    expect(r.missingRequired).toContain('amountPaise');
  });

  it('reports unknown headers as warnings', () => {
    const r = mapColumns(['merchantTxnId', 'orderRef', 'paymentRef', 'customerId', 'type', 'amountPaise', 'date', 'unknownField'], 'merchant');
    expect(r.unknownHeaders).toContain('unknownField');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('mapColumns — razorpay', () => {
  it('maps all required razorpay fields', () => {
    const headers = ['paymentId', 'orderId', 'settlementId', 'status', 'amountPaise', 'feePaise', 'taxPaise', 'netPaise', 'createdAt', 'settledAt', 'utr'];
    const r = mapColumns(headers, 'razorpay');
    expect(r.missingRequired).toHaveLength(0);
  });

  it('maps "Razorpay Payment ID" → paymentId', () => {
    const r = mapColumns(['razorpay_payment_id', 'orderId', 'settlementId', 'status', 'amountPaise', 'feePaise', 'taxPaise', 'netPaise', 'createdAt', 'settledAt', 'utr'], 'razorpay');
    expect(r.mappedFields['razorpay_payment_id']).toBe('paymentId');
  });
});

describe('mapColumns — bank', () => {
  it('maps all required bank fields', () => {
    const headers = ['bankRef', 'type', 'amountPaise', 'date', 'valueDate', 'utr', 'narration'];
    const r = mapColumns(headers, 'bank');
    expect(r.missingRequired).toHaveLength(0);
  });

  it('maps "reference_no" → bankRef', () => {
    const r = mapColumns(['reference_no', 'type', 'amountPaise', 'date', 'valueDate', 'utr'], 'bank');
    expect(r.mappedFields['reference_no']).toBe('bankRef');
  });
});

describe('applyMapping', () => {
  it('produces logical-keyed output', () => {
    const r = mapColumns(['Payment ID', 'amountPaise', 'date', 'orderRef', 'merchantTxnId', 'customerId', 'type'], 'merchant');
    const row = { 'Payment ID': 'pay_001', 'amountPaise': '10000', date: '2024-01-15', orderRef: 'ORD1', merchantTxnId: 'TXN1', customerId: 'C1', type: 'sale' };
    const mapped = applyMapping(row, r.mappedFields);
    expect(mapped['paymentRef']).toBe('pay_001');
    expect(mapped['amountPaise']).toBe('10000');
  });
});
