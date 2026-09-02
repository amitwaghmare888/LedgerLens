/**
 * Tests for Deterministic Verifier
 *
 * Critical: These tests ensure AI output is properly verified before acceptance.
 * NO real API keys. NO external network. MOCKED responses only.
 */
import { describe, it, expect } from 'vitest';
import { verifyAIOutput } from '../deterministic-verifier';
import type { AIOutput } from '../response-schema';
import type { NormalizedRecord, EngineException } from '../../domain/types';

describe('Deterministic Verifier', () => {
  const createMockException = (): EngineException => ({
    id: 'exc-test-001',
    runId: 'run-001',
    sourceRecordIds: ['mrch-001', 'rzpy-001'],
    type: 'AMOUNT_MISMATCH',
    severity: 'high',
    amountPaise: 50000,
    description: 'Test exception',
    priorityScore: 75,
    createdAt: '2024-01-01T00:00:00Z',
  });

  const createMockRecord = (
    id: string,
    source: 'merchant' | 'razorpay' | 'bank',
    amountPaise: number
  ): NormalizedRecord => ({
    id,
    runId: 'run-001',
    source,
    externalRef: `${source}-ref-${id}`,
    paymentRef: source === 'merchant' || source === 'razorpay' ? 'pay_ABC123' : '',
    orderId: 'order_XYZ789',
    settlementRef: source === 'razorpay' ? 'setl_DEF456' : '',
    utr: source === 'razorpay' || source === 'bank' ? 'UTR1234567890' : '',
    amountPaise,
    feePaise: source === 'razorpay' ? 1000 : 0,
    taxPaise: source === 'razorpay' ? 180 : 0,
    netPaise: source === 'razorpay' ? amountPaise - 1180 : amountPaise,
    occurredAt: new Date('2024-01-01'),
    settledAt: source !== 'merchant' ? new Date('2024-01-02') : null,
    rawJson: '{}',
  });

  it('accepts valid AI_SUPPORTED conclusion with correct data', () => {
    const exception = createMockException();
    const linkedRecords = [
      createMockRecord('mrch-001', 'merchant', 50000),
      createMockRecord('rzpy-001', 'razorpay', 50000),
    ];
    const candidateRecords = [...linkedRecords];
    const allRecordsById = new Map(candidateRecords.map((r) => [r.id, r]));

    const aiOutput: AIOutput = {
      conclusion: 'supported',
      summary: 'Records match via paymentRef pay_ABC123',
      candidateRecordIds: ['mrch-001', 'rzpy-001'],
      evidence: ['Shared paymentRef: pay_ABC123', 'Amounts match within tolerance'],
      discrepancies: [],
      recommendedAction: 'Accept match',
    };

    const result = verifyAIOutput(aiOutput, exception, linkedRecords, candidateRecords, allRecordsById);
    expect(result.status).toBe('AI_SUPPORTED');
    expect(result.failureReasons).toHaveLength(0);
  });

  it('rejects AI output with fabricated record ID', () => {
    const exception = createMockException();
    const linkedRecords = [createMockRecord('mrch-001', 'merchant', 50000)];
    const candidateRecords = [...linkedRecords];
    const allRecordsById = new Map(candidateRecords.map((r) => [r.id, r]));

    const aiOutput: AIOutput = {
      conclusion: 'supported',
      summary: 'Match found',
      candidateRecordIds: ['mrch-001', 'FAKE-ID-999'], // Fabricated ID
      evidence: [],
      discrepancies: [],
      recommendedAction: 'Accept',
    };

    const result = verifyAIOutput(aiOutput, exception, linkedRecords, candidateRecords, allRecordsById);
    expect(result.status).toBe('AI_REJECTED');
    expect(result.failureReasons.some((f) => f.includes('non-existent'))).toBe(true);
  });

  it('rejects AI output with ID not in candidate list', () => {
    const exception = createMockException();
    const linkedRecords = [createMockRecord('mrch-001', 'merchant', 50000)];
    const candidateRecords = [...linkedRecords];
    const outsideRecord = createMockRecord('rzpy-999', 'razorpay', 50000);
    const allRecordsById = new Map([...candidateRecords, outsideRecord].map((r) => [r.id, r]));

    const aiOutput: AIOutput = {
      conclusion: 'supported',
      summary: 'Match found',
      candidateRecordIds: ['mrch-001', 'rzpy-999'], // Not in candidate list
      evidence: [],
      discrepancies: [],
      recommendedAction: 'Accept',
    };

    const result = verifyAIOutput(aiOutput, exception, linkedRecords, candidateRecords, allRecordsById);
    expect(result.status).toBe('AI_REJECTED');
    expect(result.failureReasons.some((f) => f.includes('not in candidate list'))).toBe(true);
  });

  it('rejects AI output with fabricated amount', () => {
    const exception = createMockException();
    const linkedRecords = [createMockRecord('mrch-001', 'merchant', 50000)];
    const candidateRecords = [...linkedRecords];
    const allRecordsById = new Map(candidateRecords.map((r) => [r.id, r]));

    const aiOutput: AIOutput = {
      conclusion: 'supported',
      summary: 'Amount is ₹999.99', // Fabricated amount
      candidateRecordIds: ['mrch-001'],
      evidence: ['Found transaction for ₹999.99'],
      discrepancies: [],
      recommendedAction: 'Accept',
    };

    const result = verifyAIOutput(aiOutput, exception, linkedRecords, candidateRecords, allRecordsById);
    expect(result.status).toBe('AI_REJECTED');
    expect(result.failureReasons.some((f) => f.includes('amount'))).toBe(true);
  });

  it('rejects AI output with fabricated identifier', () => {
    const exception = createMockException();
    const linkedRecords = [createMockRecord('mrch-001', 'merchant', 50000)];
    const candidateRecords = [...linkedRecords];
    const allRecordsById = new Map(candidateRecords.map((r) => [r.id, r]));

    const aiOutput: AIOutput = {
      conclusion: 'supported',
      summary: 'Matched via pay_FAKE123', // Fabricated identifier
      candidateRecordIds: ['mrch-001'],
      evidence: ['PaymentRef: pay_FAKE123'],
      discrepancies: [],
      recommendedAction: 'Accept',
    };

    const result = verifyAIOutput(aiOutput, exception, linkedRecords, candidateRecords, allRecordsById);
    expect(result.status).toBe('AI_REJECTED');
    expect(result.failureReasons.some((f) => f.includes('identifier'))).toBe(true);
  });

  it('accepts inconclusive conclusion without verification', () => {
    const exception = createMockException();
    const linkedRecords = [createMockRecord('mrch-001', 'merchant', 50000)];
    const candidateRecords = [...linkedRecords];
    const allRecordsById = new Map(candidateRecords.map((r) => [r.id, r]));

    const aiOutput: AIOutput = {
      conclusion: 'inconclusive',
      summary: 'Insufficient evidence to determine relationship',
      candidateRecordIds: [],
      evidence: [],
      discrepancies: [{ field: 'amount', observation: 'No clear arithmetic relationship' }],
      recommendedAction: 'Manual review required',
    };

    const result = verifyAIOutput(aiOutput, exception, linkedRecords, candidateRecords, allRecordsById);
    expect(result.status).toBe('INCONCLUSIVE');
    expect(result.failureReasons).toHaveLength(0);
  });

  it('rejects 3-way match with arithmetic violation', () => {
    const exception = createMockException();
    const merchantRec = createMockRecord('mrch-001', 'merchant', 50000);
    const razorpayRec = createMockRecord('rzpy-001', 'razorpay', 50000);
    const bankRec = createMockRecord('bank-001', 'bank', 40000); // Wrong net amount
    const linkedRecords = [merchantRec, razorpayRec, bankRec];
    const candidateRecords = [...linkedRecords];
    const allRecordsById = new Map(candidateRecords.map((r) => [r.id, r]));

    const aiOutput: AIOutput = {
      conclusion: 'supported',
      summary: '3-way match found',
      candidateRecordIds: ['mrch-001', 'rzpy-001', 'bank-001'],
      evidence: [],
      discrepancies: [],
      recommendedAction: 'Accept',
    };

    const result = verifyAIOutput(aiOutput, exception, linkedRecords, candidateRecords, allRecordsById);
    expect(result.status).toBe('AI_REJECTED');
    expect(result.failureReasons.some((f) => f.includes('3-way mismatch'))).toBe(true);
  });

  it('rejects unsupported conclusion when claimed', () => {
    const exception = createMockException();
    const linkedRecords = [createMockRecord('mrch-001', 'merchant', 50000)];
    const candidateRecords = [...linkedRecords];
    const allRecordsById = new Map(candidateRecords.map((r) => [r.id, r]));

    const aiOutput: AIOutput = {
      conclusion: 'unsupported',
      summary: 'Records do not form valid relationship',
      candidateRecordIds: ['mrch-001'],
      evidence: ['No matching identifiers', 'Amount discrepancy too large'],
      discrepancies: [],
      recommendedAction: 'Keep as exception',
    };

    const result = verifyAIOutput(aiOutput, exception, linkedRecords, candidateRecords, allRecordsById);
    expect(result.status).toBe('AI_REJECTED');
  });

  it('rejects when merchant and razorpay have no shared identifier', () => {
    const exception = createMockException();
    const merchantRec = createMockRecord('mrch-001', 'merchant', 50000);
    merchantRec.paymentRef = 'pay_AAA';
    merchantRec.orderId = 'order_AAA';
    const razorpayRec = createMockRecord('rzpy-001', 'razorpay', 50000);
    razorpayRec.paymentRef = 'pay_BBB';
    razorpayRec.orderId = 'order_BBB';
    const linkedRecords = [merchantRec, razorpayRec];
    const candidateRecords = [...linkedRecords];
    const allRecordsById = new Map(candidateRecords.map((r) => [r.id, r]));

    const aiOutput: AIOutput = {
      conclusion: 'supported',
      summary: 'Match found',
      candidateRecordIds: ['mrch-001', 'rzpy-001'],
      evidence: [],
      discrepancies: [],
      recommendedAction: 'Accept',
    };

    const result = verifyAIOutput(aiOutput, exception, linkedRecords, candidateRecords, allRecordsById);
    expect(result.status).toBe('AI_REJECTED');
    expect(result.failureReasons.some((f) => f.includes('no shared identifier'))).toBe(true);
  });
});
