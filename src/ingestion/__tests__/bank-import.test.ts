/**
 * Bank CSV import regression test
 */
import { describe, it, expect } from 'vitest';
import { runImportPipeline } from '../import-pipeline';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Bank CSV Import', () => {
  it('should successfully import bank_statement_demo.csv', () => {
    const csvPath = join(process.cwd(), 'docs', 'test-data', 'bank_statement_demo.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    const result = runImportPipeline({
      fileContent: csvContent,
      filename: 'bank_statement_demo.csv',
      format: 'csv',
      source: 'bank',
      runId: 'test_bank_import',
    });
    
    // Should not throw
    expect(result).toBeDefined();
    expect(result.result.source).toBe('bank');
    expect(result.result.validRows).toBeGreaterThan(0);
    expect(result.result.invalidRows).toBe(0);
    expect(result.validRecords.length).toBeGreaterThan(0);
    
    // Check that all records are bank records
    result.validRecords.forEach(record => {
      expect(record.source).toBe('bank');
      expect(record.utr).toBeDefined();
    });
  });
  
  it('should detect all required bank columns', () => {
    const csvContent = `bankRef,type,amountPaise,date,valueDate,utr,narration
BANK001,credit,100000,2024-01-01,2024-01-01,UTR001,Test`;
    
    const result = runImportPipeline({
      fileContent: csvContent,
      filename: 'test.csv',
      format: 'csv',
      source: 'bank',
      runId: 'test_columns',
    });
    
    expect(result.result.validRows).toBe(1);
    expect(result.validRecords[0].source).toBe('bank');
  });
  
  it('should reject bank CSV missing required columns', () => {
    const csvContent = `bankRef,type,amountPaise
BANK001,credit,100000`;
    
    expect(() => {
      runImportPipeline({
        fileContent: csvContent,
        filename: 'bad.csv',
        format: 'csv',
        source: 'bank',
        runId: 'test_missing',
      });
    }).toThrow(/missing required columns/);
  });
});
