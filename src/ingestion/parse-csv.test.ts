/**
 * Tests — CSV Parser
 */
import { describe, it, expect } from 'vitest';
import { parseCsv, CSV_MAX_ROWS, CsvParseError } from './parse-csv';

const MERCHANT_CSV = `merchantTxnId,orderRef,paymentRef,customerId,type,amountPaise,date,description
TXN001,ORD001,pay_001,CUST1,sale,10000,2024-01-15,Test sale
TXN002,ORD002,pay_002,CUST2,refund,5000,2024-01-16,Refund`;

const RAZORPAY_CSV = `paymentId,orderId,settlementId,status,amountPaise,feePaise,taxPaise,netPaise,createdAt,settledAt,utr
pay_001,order_001,setl_001,captured,10000,236,42,9722,2024-01-15,2024-01-17,UTR001`;

const BANK_CSV = `bankRef,type,amountPaise,date,valueDate,utr,narration
BANK001,credit,9722,2024-01-17,2024-01-17,UTR001,Razorpay settlement`;

describe('parseCsv', () => {
  it('parses valid merchant CSV', () => {
    const rows = parseCsv(MERCHANT_CSV, 'merchant.csv');
    expect(rows).toHaveLength(2);
    expect(rows[0].merchantTxnId).toBe('TXN001');
    expect(rows[0].type).toBe('sale');
  });

  it('parses valid razorpay CSV', () => {
    const rows = parseCsv(RAZORPAY_CSV, 'razorpay.csv');
    expect(rows).toHaveLength(1);
    expect(rows[0].paymentId).toBe('pay_001');
    expect(rows[0].status).toBe('captured');
  });

  it('parses valid bank CSV', () => {
    const rows = parseCsv(BANK_CSV, 'bank.csv');
    expect(rows).toHaveLength(1);
    expect(rows[0].bankRef).toBe('BANK001');
    expect(rows[0].utr).toBe('UTR001');
  });

  it('trims whitespace from headers and values', () => {
    const csv = ` merchantTxnId , orderRef , paymentRef , customerId , type , amountPaise , date , description \nTXN001,ORD001,pay_001,CUST1,sale,10000,2024-01-15,Test`;
    const rows = parseCsv(csv, 'spaced.csv');
    expect(rows[0].merchantTxnId).toBe('TXN001');
  });

  it('throws on empty file', () => {
    expect(() => parseCsv('', 'empty.csv')).toThrow(CsvParseError);
    expect(() => parseCsv('   ', 'blank.csv')).toThrow(CsvParseError);
  });

  it('throws if row count exceeds limit', () => {
    const header = 'a\n';
    const rows = Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `v${i}`).join('\n');
    expect(() => parseCsv(header + rows, 'big.csv')).toThrow(CsvParseError);
  });

  it('handles BOM prefix', () => {
    const csv = '\uFEFFmerchantTxnId,orderRef,paymentRef,customerId,type,amountPaise,date\nTXN001,ORD001,pay_001,CUST1,sale,10000,2024-01-15';
    // papaparse strips BOM; should not throw
    expect(() => parseCsv(csv, 'bom.csv')).not.toThrow();
  });

  it('handles malformed row (extra commas) without crashing', () => {
    const csv = 'merchantTxnId,orderRef,paymentRef,customerId,type,amountPaise,date\nTXN001,ORD001,pay_001,CUST1,sale,10000,2024-01-15,extra,more';
    // papaparse handles extra columns — should parse without throwing
    expect(() => parseCsv(csv, 'extra.csv')).not.toThrow();
  });
});
