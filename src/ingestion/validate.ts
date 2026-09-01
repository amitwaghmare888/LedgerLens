/**
 * LedgerLens Ingestion — Row Validation
 *
 * Validates mapped rows against existing domain Zod schemas.
 * Invalid rows are captured with their errors — they NEVER enter the engine.
 *
 * Money: must be exact integer paise.
 * Dates: must parse to valid Date objects.
 *
 * This module does NOT perform reconciliation matching.
 * It only validates that a row is a structurally sound domain record.
 */
import type { NormalizedRecord } from '../domain/types';
import {
  normalizeMerchant,
  normalizeRazorpay,
  normalizeBank,
} from '../reconciliation/normalize';
import type { ImportSource, ParsedRow, RowError } from './types';

// ============================================================
// Paise parsing
// ============================================================

/**
 * Converts a string value to integer paise.
 *
 * Accepts: "10000", "100.00" (must be whole rupees expressed in paise if paise=true).
 *
 * Explicitly REJECTS:
 * - "₹abc", "abc", ""
 * - Non-integer values (e.g. "12.345")
 * - Negative values for fields that must be non-negative
 *
 * The field is expected to already BE in paise (integer). If the file contains
 * rupee amounts, the operator must multiply before import — we do not silently
 * convert.
 */
export function parsePaise(raw: string, field: string): { value: number; error?: string } {
  const stripped = raw.replace(/[₹,\s]/g, '');
  if (stripped === '') {
    return { value: 0, error: `${field}: empty value` };
  }
  // Must be a plain integer (no decimal point)
  if (!/^-?\d+$/.test(stripped)) {
    return { value: 0, error: `${field}: "${raw}" is not a valid integer paise amount` };
  }
  const n = parseInt(stripped, 10);
  if (!Number.isSafeInteger(n)) {
    return { value: 0, error: `${field}: "${raw}" exceeds safe integer range` };
  }
  return { value: n };
}

// ============================================================
// Date parsing
// ============================================================

/**
 * Parses a date string to a Date object.
 * Accepts ISO 8601 and common Indian formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD.
 */
export function parseDate(raw: string, field: string): { value: Date; error?: string } {
  if (!raw || raw.trim() === '') {
    return { value: new Date(NaN), error: `${field}: empty date` };
  }

  // Try direct ISO parse first
  let d = new Date(raw);
  if (!isNaN(d.getTime())) return { value: d };

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    d = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return { value: d };
  }

  return { value: new Date(NaN), error: `${field}: "${raw}" is not a valid date` };
}

// ============================================================
// Per-source row → domain record conversion
// ============================================================

function mappedToMerchantRaw(row: ParsedRow): Record<string, unknown> | { errors: string[] } {
  const errors: string[] = [];

  const amount = parsePaise(row.amountPaise ?? '', 'amountPaise');
  if (amount.error) errors.push(amount.error);

  const date = parseDate(row.date ?? '', 'date');
  if (date.error) errors.push(date.error);

  const type = row.type?.toLowerCase();
  if (!['sale', 'refund', 'adjustment'].includes(type ?? '')) {
    errors.push(`type: "${row.type}" must be sale, refund, or adjustment`);
  }

  if (errors.length > 0) return { errors };

  return {
    merchantTxnId: row.merchantTxnId ?? '',
    orderRef: row.orderRef ?? '',
    paymentRef: row.paymentRef ?? '',
    customerId: row.customerId ?? '',
    type,
    amountPaise: amount.value,
    date: date.value,
    description: row.description ?? '',
  };
}

function mappedToRazorpayRaw(row: ParsedRow): Record<string, unknown> | { errors: string[] } {
  const errors: string[] = [];

  const amount = parsePaise(row.amountPaise ?? '', 'amountPaise');
  if (amount.error) errors.push(amount.error);

  const fee = parsePaise(row.feePaise ?? '', 'feePaise');
  if (fee.error) errors.push(fee.error);

  const tax = parsePaise(row.taxPaise ?? '', 'taxPaise');
  if (tax.error) errors.push(tax.error);

  const net = parsePaise(row.netPaise ?? '', 'netPaise');
  if (net.error) errors.push(net.error);

  const createdAt = parseDate(row.createdAt ?? '', 'createdAt');
  if (createdAt.error) errors.push(createdAt.error);

  const settledAt = parseDate(row.settledAt ?? '', 'settledAt');
  if (settledAt.error) errors.push(settledAt.error);

  const status = row.status?.toLowerCase();
  if (!['captured', 'refunded', 'partially_refunded'].includes(status ?? '')) {
    errors.push(`status: "${row.status}" must be captured, refunded, or partially_refunded`);
  }

  if (errors.length > 0) return { errors };

  return {
    paymentId: row.paymentId ?? '',
    orderId: row.orderId ?? '',
    settlementId: row.settlementId ?? '',
    status,
    amountPaise: amount.value,
    feePaise: fee.value,
    taxPaise: tax.value,
    netPaise: net.value,
    createdAt: createdAt.value,
    settledAt: settledAt.value,
    utr: row.utr ?? '',
  };
}

function mappedToBankRaw(row: ParsedRow): Record<string, unknown> | { errors: string[] } {
  const errors: string[] = [];

  const amount = parsePaise(row.amountPaise ?? '', 'amountPaise');
  if (amount.error) errors.push(amount.error);

  const date = parseDate(row.date ?? '', 'date');
  if (date.error) errors.push(date.error);

  const valueDate = parseDate(row.valueDate ?? '', 'valueDate');
  if (valueDate.error) errors.push(valueDate.error);

  const type = row.type?.toLowerCase();
  if (!['credit', 'debit'].includes(type ?? '')) {
    errors.push(`type: "${row.type}" must be credit or debit`);
  }

  if (errors.length > 0) return { errors };

  return {
    bankRef: row.bankRef ?? '',
    type,
    amountPaise: amount.value,
    date: date.value,
    valueDate: valueDate.value,
    utr: row.utr ?? '',
    narration: row.narration ?? '',
  };
}

// ============================================================
// Main validation function
// ============================================================

export interface ValidationResult {
  valid: NormalizedRecord[];
  invalid: RowError[];
}

/**
 * Validates an array of mapped rows for a given source.
 *
 * Each row is converted to the domain schema and passed through the existing
 * normalization functions (which apply the same Zod schemas as the engine).
 *
 * Invalid rows are captured with their errors — they never reach the engine.
 */
export function validateRows(
  rows: ParsedRow[],
  source: ImportSource,
  runId: string,
  /** 1-based offset of the first data row in the original file (normally 2, after header). */
  firstDataRowNumber = 2
): ValidationResult {
  const valid: NormalizedRecord[] = [];
  const invalid: RowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = firstDataRowNumber + i;

    try {
      let record: NormalizedRecord;

      switch (source) {
        case 'merchant': {
          const raw = mappedToMerchantRaw(row);
          if ('errors' in raw && Array.isArray(raw.errors)) throw new Error((raw.errors as string[]).join('; '));
          record = normalizeMerchant(raw, runId);
          break;
        }
        case 'razorpay': {
          const raw = mappedToRazorpayRaw(row);
          if ('errors' in raw && Array.isArray(raw.errors)) throw new Error((raw.errors as string[]).join('; '));
          record = normalizeRazorpay(raw, runId);
          break;
        }
        case 'bank': {
          const raw = mappedToBankRaw(row);
          if ('errors' in raw && Array.isArray(raw.errors)) throw new Error((raw.errors as string[]).join('; '));
          record = normalizeBank(raw, runId);
          break;
        }
      }

      valid.push(record);
    } catch (e) {
      invalid.push({
        rowNumber,
        rawRow: row,
        errors: [String(e instanceof Error ? e.message : e)],
      });
    }
  }

  return { valid, invalid };
}
