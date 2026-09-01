/**
 * Tests — Import Pipeline (end-to-end ingestion)
 *
 * CSV and XLSX both converge to the same NormalizedRecord output.
 * This test validates the full pipeline without any DB writes.
 */
import { describe, it, expect } from 'vitest';
import { runImportPipeline } from './import-pipeline';

const MERCHANT_CSV = `merchantTxnId,orderRef,paymentRef,customerId,type,amountPaise,date,description
TXN001,ORD001,pay_001,CUST1,sale,10000,2024-01-15,Test sale
TXN002,ORD002,pay_002,CUST2,refund,5000,2024-01-16,Refund`;

const RAZORPAY_CSV = `paymentId,orderId,settlementId,status,amountPaise,feePaise,taxPaise,netPaise,createdAt,settledAt,utr
pay_001,order_001,setl_001,captured,10000,236,42,9722,2024-01-15,2024-01-17,UTR001`;

const BANK_CSV = `bankRef,type,amountPaise,date,valueDate,utr,narration
BANK001,credit,9722,2024-01-17,2024-01-17,UTR001,Razorpay settlement`;

describe('runImportPipeline — CSV', () => {
  it('merchant CSV: 2 valid rows', () => {
    const { result, validRecords } = runImportPipeline({
      fileContent: MERCHANT_CSV,
      filename: 'merchant.csv',
      format: 'csv',
      source: 'merchant',
      runId: 'run_test',
    });
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);
    expect(validRecords).toHaveLength(2);
    expect(validRecords[0].amountPaise).toBe(10000);
    expect(validRecords[0].source).toBe('merchant');
  });

  it('razorpay CSV: 1 valid row', () => {
    const { result, validRecords } = runImportPipeline({
      fileContent: RAZORPAY_CSV,
      filename: 'razorpay.csv',
      format: 'csv',
      source: 'razorpay',
      runId: 'run_test',
    });
    expect(result.validRows).toBe(1);
    expect(validRecords[0].feePaise).toBe(236);
    expect(validRecords[0].taxPaise).toBe(42);
    expect(validRecords[0].netPaise).toBe(9722);
  });

  it('bank CSV: 1 valid row', () => {
    const { result, validRecords } = runImportPipeline({
      fileContent: BANK_CSV,
      filename: 'bank.csv',
      format: 'csv',
      source: 'bank',
      runId: 'run_test',
    });
    expect(result.validRows).toBe(1);
    expect(validRecords[0].source).toBe('bank');
    expect(validRecords[0].amountPaise).toBe(9722);
    expect(validRecords[0].utr).toBe('UTR001');
  });

  it('mixed valid/invalid rows: invalid stay out of validRecords', () => {
    const csv = `merchantTxnId,orderRef,paymentRef,customerId,type,amountPaise,date
TXN001,ORD001,pay_001,CUST1,sale,10000,2024-01-15
TXN002,ORD002,pay_002,CUST2,sale,NOT_A_NUMBER,2024-01-16
TXN003,ORD003,pay_003,CUST3,sale,8000,2024-01-17`;

    const { result, validRecords } = runImportPipeline({
      fileContent: csv, filename: 'mixed.csv', format: 'csv', source: 'merchant', runId: 'run_test',
    });
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(1);
    expect(result.rowErrors[0].rowNumber).toBe(3);
    expect(validRecords).toHaveLength(2);
  });

  it('throws on missing required columns', () => {
    const csv = `merchantTxnId,orderRef\nTXN001,ORD001`;
    expect(() => runImportPipeline({
      fileContent: csv, filename: 'missing.csv', format: 'csv', source: 'merchant', runId: 'run_test',
    })).toThrow(/missing required columns/);
  });

  it('throws on empty file', () => {
    expect(() => runImportPipeline({
      fileContent: '', filename: 'empty.csv', format: 'csv', source: 'merchant', runId: 'run_test',
    })).toThrow();
  });

  it('alias mapping: "merchant_txn_id" works', () => {
    const csv = `merchant_txn_id,order_ref,payment_ref,customer_id,type,amount_paise,date
TXN001,ORD001,pay_001,CUST1,sale,10000,2024-01-15`;
    const { result } = runImportPipeline({
      fileContent: csv, filename: 'alias.csv', format: 'csv', source: 'merchant', runId: 'run_test',
    });
    expect(result.validRows).toBe(1);
  });

  it('deterministic: same CSV → same record IDs', () => {
    const opts = { fileContent: MERCHANT_CSV, filename: 'merchant.csv', format: 'csv' as const, source: 'merchant' as const, runId: 'run_test' };
    const r1 = runImportPipeline(opts);
    const r2 = runImportPipeline(opts);
    expect(r1.validRecords[0].id).toBe(r2.validRecords[0].id);
    expect(r1.validRecords[1].id).toBe(r2.validRecords[1].id);
  });
});

describe('runImportPipeline — XLSX', () => {
  it('parses XLSX buffer with merchant data', async () => {
    // Build a minimal XLSX buffer dynamically using SheetJS
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['merchantTxnId', 'orderRef', 'paymentRef', 'customerId', 'type', 'amountPaise', 'date'],
      ['TXN_X01', 'ORD_X01', 'pay_x01', 'CUST_X', 'sale', 25000, '2024-03-10'],
      ['TXN_X02', 'ORD_X02', 'pay_x02', 'CUST_X', 'refund', 5000, '2024-03-11'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Merchant Data');
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const { result, validRecords } = runImportPipeline({
      fileContent: buf, filename: 'merchant.xlsx', format: 'xlsx', source: 'merchant', runId: 'run_xlsx_test',
    });

    expect(result.format).toBe('xlsx');
    expect(result.sheetName).toBe('Merchant Data');
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(validRecords[0].amountPaise).toBe(25000);
  });

  it('XLSX: selects requested sheet by name', async () => {
    const XLSX = await import('xlsx');
    const ws1 = XLSX.utils.aoa_to_sheet([['bankRef', 'type', 'amountPaise', 'date', 'valueDate', 'utr'], ['B001', 'credit', 9722, '2024-01-17', '2024-01-17', 'UTR1']]);
    const ws2 = XLSX.utils.aoa_to_sheet([['bankRef', 'type', 'amountPaise', 'date', 'valueDate', 'utr'], ['B002', 'debit', 500, '2024-01-18', '2024-01-18', 'UTR2']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'January');
    XLSX.utils.book_append_sheet(wb, ws2, 'February');
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const { result } = runImportPipeline({
      fileContent: buf, filename: 'bank.xlsx', format: 'xlsx', source: 'bank',
      runId: 'run_xlsx_sheet', sheetName: 'February',
    });

    expect(result.sheetName).toBe('February');
    expect(result.availableSheets).toEqual(['January', 'February']);
    expect(result.validRows).toBe(1);
  });
});

describe('Provenance', () => {
  it('every valid record carries runId and source', () => {
    const { validRecords } = runImportPipeline({
      fileContent: MERCHANT_CSV, filename: 'merchant.csv', format: 'csv', source: 'merchant', runId: 'run_prov',
    });
    for (const r of validRecords) {
      expect(r.runId).toBe('run_prov');
      expect(r.source).toBe('merchant');
    }
  });

  it('every row error carries row number', () => {
    const csv = `merchantTxnId,orderRef,paymentRef,customerId,type,amountPaise,date
TXN001,ORD001,pay_001,CUST1,sale,INVALID,2024-01-15`;
    const { result } = runImportPipeline({
      fileContent: csv, filename: 'err.csv', format: 'csv', source: 'merchant', runId: 'run_prov',
    });
    expect(result.rowErrors[0].rowNumber).toBe(2);
  });
});
