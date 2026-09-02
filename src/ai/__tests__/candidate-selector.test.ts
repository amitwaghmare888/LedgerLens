/**
 * Tests for Candidate Selector
 *
 * Ensures candidate selection is deterministic and safe.
 */
import { describe, it, expect } from 'vitest';
import { selectCandidates, validateCandidateSelection } from '../candidate-selector';
import type { NormalizedRecord, EngineException } from '../../domain/types';

describe('Candidate Selector', () => {
  const createMockException = (
    id: string,
    type: string,
    sourceRecordIds: string[]
  ): EngineException => ({
    id,
    runId: 'run-001',
    sourceRecordIds,
    type: type as EngineException['type'],
    severity: 'high',
    amountPaise: 50000,
    description: 'Test exception',
    priorityScore: 75,
    createdAt: '2024-01-01T00:00:00Z',
  });

  const createMockRecord = (
    id: string,
    source: 'merchant' | 'razorpay' | 'bank',
    paymentRef = '',
    utr = ''
  ): NormalizedRecord => ({
    id,
    runId: 'run-001',
    source,
    externalRef: `${source}-${id}`,
    paymentRef,
    orderId: '',
    settlementRef: '',
    utr,
    amountPaise: 50000,
    feePaise: 0,
    taxPaise: 0,
    netPaise: 50000,
    occurredAt: new Date('2024-01-01'),
    settledAt: null,
    rawJson: '{}',
  });

  it('includes all linked records as candidates', () => {
    const exception = createMockException('exc-001', 'MISSING_SETTLEMENT', ['mrch-001']);
    const linkedRecords = [createMockRecord('mrch-001', 'merchant')];
    const allRecords = [...linkedRecords];

    const result = selectCandidates(exception, linkedRecords, allRecords);

    expect(result.candidateRecordIds).toContain('mrch-001');
  });

  it('provides non-empty reason when only linked records are present', () => {
    const exception = createMockException('exc-001', 'AMOUNT_MISMATCH', ['mrch-001']);
    const linkedRecords = [createMockRecord('mrch-001', 'merchant')];
    const allRecords = [...linkedRecords];

    const result = selectCandidates(exception, linkedRecords, allRecords);

    expect(result.candidateRecordIds).toEqual(['mrch-001']);
    expect(result.selectionReason).toBe('Linked records only; no additional candidates identified');
    expect(validateCandidateSelection(result, exception)).toBe(true);
  });

  it('finds candidates by matching paymentRef', () => {
    const exception = createMockException('exc-001', 'MISSING_SETTLEMENT', ['mrch-001']);
    const linkedRecords = [createMockRecord('mrch-001', 'merchant', 'pay_ABC123')];
    const candidateRec = createMockRecord('rzpy-001', 'razorpay', 'pay_ABC123');
    const allRecords = [...linkedRecords, candidateRec];

    const result = selectCandidates(exception, linkedRecords, allRecords);

    expect(result.candidateRecordIds).toContain('mrch-001');
    expect(result.candidateRecordIds).toContain('rzpy-001');
    expect(result.selectionReason).toContain('paymentRef');
  });

  it('finds candidates by matching UTR', () => {
    const exception = createMockException('exc-001', 'MISSING_BANK_ENTRY', ['rzpy-001']);
    const linkedRecords = [createMockRecord('rzpy-001', 'razorpay', '', 'UTR123')];
    const candidateRec = createMockRecord('bank-001', 'bank', '', 'UTR123');
    const allRecords = [...linkedRecords, candidateRec];

    const result = selectCandidates(exception, linkedRecords, allRecords);

    expect(result.candidateRecordIds).toContain('rzpy-001');
    expect(result.candidateRecordIds).toContain('bank-001');
    expect(result.selectionReason).toContain('UTR');
  });

  it('limits total candidates to MAX_TOTAL_CANDIDATES', () => {
    const exception = createMockException('exc-001', 'MISSING_SETTLEMENT', ['mrch-001']);
    const linkedRecords = [createMockRecord('mrch-001', 'merchant', 'pay_ABC')];

    // Create 30 candidate records (more than limit of 20)
    const allRecords = [
      ...linkedRecords,
      ...Array.from({ length: 30 }, (_, i) =>
        createMockRecord(`rzpy-${i}`, 'razorpay', 'pay_ABC')
      ),
    ];

    const result = selectCandidates(exception, linkedRecords, allRecords);

    expect(result.candidateRecordIds.length).toBeLessThanOrEqual(20);
  });

  it('does not select candidates by amount alone', () => {
    const exception = createMockException('exc-001', 'MISSING_SETTLEMENT', ['mrch-001']);
    const linkedRecords = [createMockRecord('mrch-001', 'merchant', '', '')];
    // Create a razorpay record with different identifiers and different date (outside time window)
    const sameAmountRec = createMockRecord('rzpy-001', 'razorpay', 'pay_DIFFERENT', '');
    sameAmountRec.occurredAt = new Date('2025-01-01'); // Much later date
    const allRecords = [...linkedRecords, sameAmountRec];

    const result = selectCandidates(exception, linkedRecords, allRecords);

    // Should NOT include rzpy-001 just because amount matches
    expect(result.candidateRecordIds).toEqual(['mrch-001']);
  });

  it('validates that all linked records are in candidate selection', () => {
    const exception = createMockException('exc-001', 'AMOUNT_MISMATCH', ['mrch-001', 'rzpy-001']);
    const result = {
      candidateRecordIds: ['mrch-001', 'rzpy-001'],
      selectionReason: 'Test',
      totalCandidatesConsidered: 10,
    };

    const isValid = validateCandidateSelection(result, exception);
    expect(isValid).toBe(true);
  });

  it('rejects candidate selection missing linked record', () => {
    const exception = createMockException('exc-001', 'AMOUNT_MISMATCH', ['mrch-001', 'rzpy-001']);
    const result = {
      candidateRecordIds: ['mrch-001'], // Missing rzpy-001
      selectionReason: 'Test',
      totalCandidatesConsidered: 10,
    };

    const isValid = validateCandidateSelection(result, exception);
    expect(isValid).toBe(false);
  });

  it('rejects candidate selection with no reason', () => {
    const exception = createMockException('exc-001', 'AMOUNT_MISMATCH', ['mrch-001']);
    const result = {
      candidateRecordIds: ['mrch-001'],
      selectionReason: '', // Empty reason
      totalCandidatesConsidered: 10,
    };

    const isValid = validateCandidateSelection(result, exception);
    expect(isValid).toBe(false);
  });
});
