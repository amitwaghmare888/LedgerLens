/**
 * Financial Invariant Validators
 *
 * These functions validate financial rules that must hold true
 * in the synthetic dataset. They are also used in tests.
 *
 * IMPORTANT: These are synthetic assumptions for the LedgerLens dataset.
 * Real Razorpay behavior should be verified against official documentation.
 */
import { validatePaise, isValidPaise, subtractPaise, addPaise } from '../lib/money';
import type {
  RazorpaySettlementRecord,
  BankStatementRecord,
  SyntheticCase,
} from '../domain/types';

export interface InvariantResult {
  valid: boolean;
  errors: string[];
}

/** Validates that net = amount - fee - tax for a Razorpay record. */
export function validateNetCalculation(record: RazorpaySettlementRecord): InvariantResult {
  const errors: string[] = [];
  const expected = subtractPaise(
    subtractPaise(record.amountPaise, record.feePaise),
    record.taxPaise
  );
  if (expected !== record.netPaise) {
    errors.push(
      `Net mismatch: amount(${record.amountPaise}) - fee(${record.feePaise}) - tax(${record.taxPaise}) = ${expected}, but got ${record.netPaise}`
    );
  }
  return { valid: errors.length === 0, errors };
}

/** Validates all monetary amounts are valid paise values. */
export function validateMonetaryValues(record: {
  amountPaise: number;
  feePaise?: number;
  taxPaise?: number;
  netPaise?: number;
}): InvariantResult {
  const errors: string[] = [];
  const fields: [string, number | undefined][] = [
    ['amountPaise', record.amountPaise],
    ['feePaise', record.feePaise],
    ['taxPaise', record.taxPaise],
    ['netPaise', record.netPaise],
  ];
  for (const [name, value] of fields) {
    if (value !== undefined && !isValidPaise(value)) {
      errors.push(`${name} is not a valid paise value: ${value}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Validates that dates are real and ordered where required. */
export function validateDates(record: RazorpaySettlementRecord): InvariantResult {
  const errors: string[] = [];
  if (isNaN(record.createdAt.getTime())) {
    errors.push('createdAt is not a valid date');
  }
  if (isNaN(record.settledAt.getTime())) {
    errors.push('settledAt is not a valid date');
  }
  if (
    !isNaN(record.createdAt.getTime()) &&
    !isNaN(record.settledAt.getTime()) &&
    record.settledAt < record.createdAt
  ) {
    errors.push('settledAt is before createdAt');
  }
  return { valid: errors.length === 0, errors };
}

/** Validates a complete synthetic case. */
export function validateSyntheticCase(c: SyntheticCase): InvariantResult {
  const errors: string[] = [];

  // All merchant records must have valid amounts
  for (const m of c.merchantRecords) {
    const r = validateMonetaryValues(m);
    if (!r.valid) errors.push(...r.errors.map((e) => `merchant(${m.merchantTxnId}): ${e}`));
    if (m.amountPaise < 0 && m.type !== 'refund') {
      errors.push(`merchant(${m.merchantTxnId}): negative amount for non-refund`);
    }
  }

  // All Razorpay records must satisfy net = amount - fee - tax
  for (const rz of c.razorpayRecords) {
    const net = validateNetCalculation(rz);
    if (!net.valid) errors.push(...net.errors.map((e) => `razorpay(${rz.paymentId}): ${e}`));
    const dates = validateDates(rz);
    if (!dates.valid) errors.push(...dates.errors.map((e) => `razorpay(${rz.paymentId}): ${e}`));
    const monetary = validateMonetaryValues(rz);
    if (!monetary.valid)
      errors.push(...monetary.errors.map((e) => `razorpay(${rz.paymentId}): ${e}`));
    // Fees and taxes should be non-negative (synthetic assumption)
    if (rz.feePaise < 0) errors.push(`razorpay(${rz.paymentId}): negative fee`);
    if (rz.taxPaise < 0) errors.push(`razorpay(${rz.paymentId}): negative tax`);
  }

  // All bank records must have valid amounts
  for (const b of c.bankRecords) {
    const r = validateMonetaryValues(b);
    if (!r.valid) errors.push(...r.errors.map((e) => `bank(${b.bankRef}): ${e}`));
    if (b.amountPaise <= 0) errors.push(`bank(${b.bankRef}): bank amount must be positive`);
  }

  // Ground truth must reference existing records
  if (c.groundTruth.expectedMatchGroup.length === 0) {
    errors.push('Ground truth has empty expectedMatchGroup');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates batch consistency: the sum of individual settlements
 * in a batch should equal the bank credit amount.
 */
export function validateBatchTotal(
  razorpayRecords: RazorpaySettlementRecord[],
  bankRecord: BankStatementRecord
): InvariantResult {
  const errors: string[] = [];
  let totalNet = 0;
  for (const rz of razorpayRecords) {
    validatePaise(rz.netPaise);
    totalNet = addPaise(totalNet, rz.netPaise);
  }
  validatePaise(totalNet);
  if (totalNet !== bankRecord.amountPaise) {
    errors.push(
      `Batch total mismatch: sum of net settlements (${totalNet}) != bank amount (${bankRecord.amountPaise})`
    );
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates that a refund does not exceed the original payment amount.
 * Synthetic assumption: refund amount <= original payment amount.
 */
export function validateRefundAmount(
  originalAmountPaise: number,
  refundAmountPaise: number
): InvariantResult {
  const errors: string[] = [];
  validatePaise(originalAmountPaise);
  validatePaise(refundAmountPaise);
  if (refundAmountPaise < 0) {
    errors.push('Refund amount must be non-negative');
  }
  if (refundAmountPaise > originalAmountPaise) {
    errors.push(
      `Refund (${refundAmountPaise}) exceeds original amount (${originalAmountPaise})`
    );
  }
  return { valid: errors.length === 0, errors };
}
