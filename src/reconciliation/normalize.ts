/**
 * LedgerLens Reconciliation — Normalize
 *
 * Converts source-specific records into the common NormalizedRecord representation.
 *
 * BOUNDARY: This module is framework-independent.
 * No React, no database, no HTTP imports.
 *
 * Rejection policy: malformed records throw NormalizationError — never silently coerced.
 */
import { z } from 'zod';
import { isValidPaise } from '../lib/money';
import type { NormalizedRecord } from '../domain/types';
import { deterministicId } from '../lib/deterministic';

// ============================================================
// Errors
// ============================================================

export class NormalizationError extends Error {
  constructor(
    public readonly source: string,
    public readonly externalRef: string,
    public readonly field: string,
    message: string
  ) {
    super(`NormalizationError [${source}/${externalRef}] ${field}: ${message}`);
    this.name = 'NormalizationError';
  }
}

// ============================================================
// Paise validator for Zod
// ============================================================

function zodPaise(fieldName: string) {
  return z
    .number()
    .int()
    .refine((v) => isValidPaise(v), {
      message: `${fieldName} must be a valid safe integer (paise)`,
    });
}

// ============================================================
// Zod schemas for each source type
// ============================================================

export const MerchantRecordSchema = z.object({
  merchantTxnId: z.string().min(1, 'merchantTxnId is required'),
  orderRef: z.string().min(1, 'orderRef is required'),
  paymentRef: z.string().min(1, 'paymentRef is required'),
  customerId: z.string().min(1, 'customerId is required'),
  type: z.enum(['sale', 'refund', 'adjustment']),
  amountPaise: zodPaise('amountPaise'),
  date: z.date(),
  description: z.string(),
});

export const RazorpayRecordSchema = z.object({
  paymentId: z.string().min(1, 'paymentId is required'),
  orderId: z.string().min(1, 'orderId is required'),
  settlementId: z.string().min(1, 'settlementId is required'),
  status: z.enum(['captured', 'refunded', 'partially_refunded']),
  amountPaise: zodPaise('amountPaise'),
  feePaise: zodPaise('feePaise').refine((v) => v >= 0, 'feePaise must be non-negative'),
  taxPaise: zodPaise('taxPaise').refine((v) => v >= 0, 'taxPaise must be non-negative'),
  netPaise: zodPaise('netPaise'),
  createdAt: z.date(),
  settledAt: z.date(),
  utr: z.string().min(1, 'utr is required'),
});

export const BankRecordSchema = z.object({
  bankRef: z.string().min(1, 'bankRef is required'),
  type: z.enum(['credit', 'debit']),
  amountPaise: zodPaise('amountPaise').refine((v) => v > 0, 'bank amountPaise must be positive'),
  date: z.date(),
  valueDate: z.date(),
  utr: z.string().min(1, 'utr is required'),
  narration: z.string(),
});

// ============================================================
// Source record row from DB (rehydration)
// ============================================================

export interface SourceRecordRow {
  id: string;
  runId: string;
  source: 'merchant' | 'razorpay' | 'bank';
  externalRef: string;
  paymentRef: string;
  orderId: string;
  settlementRef: string;
  utr: string;
  amountPaise: number;
  feePaise: number;
  taxPaise: number;
  netPaise: number;
  occurredAt: string;
  settledAt: string | null;
  rawJson: string;
}

// ============================================================
// Normalization helpers
// ============================================================

/**
 * Normalizes a single merchant record.
 * Validates with Zod; throws NormalizationError on failure.
 */
export function normalizeMerchant(raw: unknown, runId: string): NormalizedRecord {
  const parsed = MerchantRecordSchema.safeParse(raw);
  if (!parsed.success) {
    const m = raw as { merchantTxnId?: string };
    throw new NormalizationError(
      'merchant',
      m?.merchantTxnId ?? 'unknown',
      'schema',
      parsed.error.issues.map((i) => i.message).join('; ')
    );
  }
  const m = parsed.data;
  return {
    id: deterministicId('src', m.merchantTxnId, 'merchant'),
    runId,
    source: 'merchant',
    externalRef: m.merchantTxnId,
    paymentRef: m.paymentRef,
    orderId: m.orderRef,
    settlementRef: '',
    utr: '',
    amountPaise: m.amountPaise,
    feePaise: 0,
    taxPaise: 0,
    netPaise: m.amountPaise,
    occurredAt: m.date,
    settledAt: null,
    rawJson: JSON.stringify(m, (_k, v) => (v instanceof Date ? v.toISOString() : v)),
  };
}

/**
 * Normalizes a single Razorpay settlement record.
 * Validates net = amount - fee - tax.
 */
export function normalizeRazorpay(raw: unknown, runId: string): NormalizedRecord {
  const parsed = RazorpayRecordSchema.safeParse(raw);
  if (!parsed.success) {
    const r = raw as { paymentId?: string };
    throw new NormalizationError(
      'razorpay',
      r?.paymentId ?? 'unknown',
      'schema',
      parsed.error.issues.map((i) => i.message).join('; ')
    );
  }
  const rz = parsed.data;
  const expectedNet = rz.amountPaise - rz.feePaise - rz.taxPaise;
  if (expectedNet !== rz.netPaise) {
    throw new NormalizationError(
      'razorpay',
      rz.paymentId,
      'netPaise',
      `net (${rz.netPaise}) != amount (${rz.amountPaise}) - fee (${rz.feePaise}) - tax (${rz.taxPaise}) = ${expectedNet}`
    );
  }
  return {
    id: deterministicId('src', rz.paymentId, 'razorpay'),
    runId,
    source: 'razorpay',
    externalRef: rz.paymentId,
    paymentRef: rz.paymentId,
    orderId: rz.orderId,
    settlementRef: rz.settlementId,
    utr: rz.utr,
    amountPaise: rz.amountPaise,
    feePaise: rz.feePaise,
    taxPaise: rz.taxPaise,
    netPaise: rz.netPaise,
    occurredAt: rz.createdAt,
    settledAt: rz.settledAt,
    rawJson: JSON.stringify(rz, (_k, v) => (v instanceof Date ? v.toISOString() : v)),
  };
}

/**
 * Normalizes a single bank statement record.
 */
export function normalizeBank(raw: unknown, runId: string): NormalizedRecord {
  const parsed = BankRecordSchema.safeParse(raw);
  if (!parsed.success) {
    const b = raw as { bankRef?: string };
    throw new NormalizationError(
      'bank',
      b?.bankRef ?? 'unknown',
      'schema',
      parsed.error.issues.map((i) => i.message).join('; ')
    );
  }
  const b = parsed.data;
  return {
    id: deterministicId('src', b.bankRef, 'bank'),
    runId,
    source: 'bank',
    externalRef: b.bankRef,
    paymentRef: '',
    orderId: '',
    settlementRef: '',
    utr: b.utr,
    amountPaise: b.amountPaise,
    feePaise: 0,
    taxPaise: 0,
    netPaise: b.amountPaise,
    occurredAt: b.date,
    settledAt: b.valueDate,
    rawJson: JSON.stringify(b, (_k, v) => (v instanceof Date ? v.toISOString() : v)),
  };
}

/**
 * Normalizes records from the synthetic dataset cases.
 * Throws on first malformed record.
 */
export function normalizeFromDataset(
  cases: Array<{
    merchantRecords: unknown[];
    razorpayRecords: unknown[];
    bankRecords: unknown[];
  }>,
  runId: string
): NormalizedRecord[] {
  const records: NormalizedRecord[] = [];
  for (const c of cases) {
    for (const m of c.merchantRecords) records.push(normalizeMerchant(m, runId));
    for (const rz of c.razorpayRecords) records.push(normalizeRazorpay(rz, runId));
    for (const b of c.bankRecords) records.push(normalizeBank(b, runId));
  }
  return records;
}

/**
 * Rehydrates NormalizedRecord objects from database rows.
 * DB rows are already normalized — this just restores the typed structure.
 */
export function normalizeFromDbRows(rows: SourceRecordRow[]): NormalizedRecord[] {
  return rows.map((row) => ({
    id: row.id,
    runId: row.runId,
    source: row.source,
    externalRef: row.externalRef,
    paymentRef: row.paymentRef,
    orderId: row.orderId ?? '',
    settlementRef: row.settlementRef,
    utr: row.utr,
    amountPaise: row.amountPaise,
    feePaise: row.feePaise,
    taxPaise: row.taxPaise,
    netPaise: row.netPaise,
    occurredAt: new Date(row.occurredAt),
    settledAt: row.settledAt ? new Date(row.settledAt) : null,
    rawJson: row.rawJson,
  }));
}
