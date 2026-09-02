/**
 * Tests for Evidence Builder
 *
 * Ensures no hidden metadata leaks to AI.
 */
import { describe, it, expect } from 'vitest';
import { buildEvidencePacket, validateEvidencePacket, sanitizeRawJson } from '../evidence-builder';
import type { NormalizedRecord, EngineException } from '../../domain/types';

describe('Evidence Builder', () => {
  const createMockException = (): EngineException => ({
    id: 'exc-001',
    runId: 'run-001',
    sourceRecordIds: ['mrch-001'],
    type: 'MISSING_SETTLEMENT',
    severity: 'high',
    amountPaise: 50000,
    description: 'Test exception',
    priorityScore: 75,
    createdAt: '2024-01-01T00:00:00Z',
  });

  const createMockRecord = (id: string): NormalizedRecord => ({
    id,
    runId: 'run-001',
    source: 'merchant',
    externalRef: 'ref-001',
    paymentRef: 'pay_ABC123',
    orderId: 'order_XYZ789',
    settlementRef: '',
    utr: '',
    amountPaise: 50000,
    feePaise: 0,
    taxPaise: 0,
    netPaise: 50000,
    occurredAt: new Date('2024-01-01'),
    settledAt: null,
    rawJson: '{"test":"data"}',
  });

  it('builds evidence packet with only observable data', () => {
    const exception = createMockException();
    const sourceRecords = [createMockRecord('mrch-001')];
    const deterministicFindings = ['No Razorpay settlement found'];
    const candidateIds = ['mrch-001'];

    const evidence = buildEvidencePacket(
      exception,
      sourceRecords,
      deterministicFindings,
      candidateIds
    );

    expect(evidence.exceptionId).toBe('exc-001');
    expect(evidence.exceptionType).toBe('MISSING_SETTLEMENT');
    expect(evidence.evidence.linkedRecords).toHaveLength(1);
    expect(evidence.evidence.linkedRecords[0].id).toBe('mrch-001');
    expect(evidence.candidateRecordIds).toEqual(['mrch-001']);
  });

  it('excludes rawJson from evidence packet', () => {
    const exception = createMockException();
    const sourceRecords = [createMockRecord('mrch-001')];
    const evidence = buildEvidencePacket(exception, sourceRecords, [], ['mrch-001']);

    const jsonStr = JSON.stringify(evidence);
    expect(jsonStr).not.toContain('rawJson');
  });

  it('validates evidence packet has no hidden metadata', () => {
    const exception = createMockException();
    const sourceRecords = [createMockRecord('mrch-001')];
    const evidence = buildEvidencePacket(exception, sourceRecords, [], ['mrch-001']);

    const isValid = validateEvidencePacket(evidence);
    expect(isValid).toBe(true);
  });

  it('rejects evidence packet with groundTruth', () => {
    const exception = createMockException();
    const sourceRecords = [createMockRecord('mrch-001')];
    const evidence = buildEvidencePacket(exception, sourceRecords, [], ['mrch-001']);

    // Inject forbidden term
    const tamperedEvidence = { ...evidence, groundTruth: { expectedStatus: 'matched' } };

    const isValid = validateEvidencePacket(tamperedEvidence);
    expect(isValid).toBe(false);
  });

  it('rejects evidence packet with scenarioType', () => {
    const exception = createMockException();
    const sourceRecords = [createMockRecord('mrch-001')];
    const evidence = buildEvidencePacket(exception, sourceRecords, [], ['mrch-001']);

    const tamperedEvidence = { ...evidence, scenarioType: 'clean-match' };

    const isValid = validateEvidencePacket(tamperedEvidence);
    expect(isValid).toBe(false);
  });

  it('rejects evidence packet with isTrap', () => {
    const exception = createMockException();
    const sourceRecords = [createMockRecord('mrch-001')];
    const evidence = buildEvidencePacket(exception, sourceRecords, [], ['mrch-001']);

    const tamperedEvidence = { ...evidence, isTrap: true };

    const isValid = validateEvidencePacket(tamperedEvidence);
    expect(isValid).toBe(false);
  });

  it('sanitizes raw JSON to remove forbidden fields', () => {
    const rawJson = JSON.stringify({
      amount: 50000,
      groundTruth: { expectedStatus: 'matched' },
      scenarioType: 'clean-match',
      isTrap: false,
      paymentRef: 'pay_ABC123',
    });

    const sanitized = sanitizeRawJson(rawJson);
    const parsed = JSON.parse(sanitized);

    expect(parsed.amount).toBe(50000);
    expect(parsed.paymentRef).toBe('pay_ABC123');
    expect(parsed.groundTruth).toBeUndefined();
    expect(parsed.scenarioType).toBeUndefined();
    expect(parsed.isTrap).toBeUndefined();
  });

  it('handles invalid JSON in sanitizeRawJson', () => {
    const invalidJson = 'not valid json';
    const sanitized = sanitizeRawJson(invalidJson);
    expect(sanitized).toBe('{}');
  });
});
