/**
 * LedgerLens Ingestion — Column Mapping
 *
 * Deterministic alias-based mapping. No LLM, no fuzzy matching, no guessing.
 *
 * Rules:
 * 1. Exact match (case-insensitive, trimmed, separator-normalized)
 * 2. Alias match (documented per-source alias table only)
 * 3. Missing required → error (never silently ignored)
 * 4. Unknown headers → warning
 *
 * Separator normalization: space, underscore, hyphen, and camelCase
 * boundaries all collapse to the same canonical form for alias lookup.
 */
import type { ImportSource, MappingResult, ParsedRow } from './types';

// ============================================================
// Canonical logical field names per source
// ============================================================

const MERCHANT_REQUIRED = [
  'merchantTxnId',
  'orderRef',
  'paymentRef',
  'customerId',
  'type',
  'amountPaise',
  'date',
] as const;

export const MERCHANT_OPTIONAL = ['description'] as const;

const RAZORPAY_REQUIRED = [
  'paymentId',
  'orderId',
  'settlementId',
  'status',
  'amountPaise',
  'feePaise',
  'taxPaise',
  'netPaise',
  'createdAt',
  'settledAt',
  'utr',
] as const;

const BANK_REQUIRED = [
  'bankRef',
  'type',
  'amountPaise',
  'date',
  'valueDate',
  'utr',
] as const;

export const BANK_OPTIONAL = ['narration'] as const;

// ============================================================
// Alias tables — EXPLICIT ONLY. No undocumented guessing.
// Each alias maps a raw header variant → logical field name.
// ============================================================

type AliasMap = Record<string, string>; // canonical-key → logical field

function buildAliasMap(entries: [string[], string][]): AliasMap {
  const map: AliasMap = {};
  for (const [aliases, field] of entries) {
    for (const alias of aliases) {
      map[canonicalize(alias)] = field;
    }
  }
  return map;
}

const MERCHANT_ALIASES: AliasMap = buildAliasMap([
  [['merchantTxnId', 'merchant_txn_id', 'merchant txn id', 'txn_id', 'txnid', 'transaction_id', 'transaction id'], 'merchantTxnId'],
  [['orderRef', 'order_ref', 'order ref', 'order_reference', 'order reference', 'orderreference'], 'orderRef'],
  [['paymentRef', 'payment_ref', 'payment ref', 'payment_reference', 'payment reference', 'payment_id', 'paymentid'], 'paymentRef'],
  [['customerId', 'customer_id', 'customer id', 'customerid', 'customer'], 'customerId'],
  [['type', 'txn_type', 'txntype', 'transaction_type', 'transaction type'], 'type'],
  [['amountPaise', 'amount_paise', 'amount paise', 'amount', 'gross_amount', 'gross amount', 'grossamount'], 'amountPaise'],
  [['date', 'txn_date', 'txn date', 'transaction_date', 'transaction date'], 'date'],
  [['description', 'desc', 'narration', 'remarks', 'note', 'notes'], 'description'],
]);

const RAZORPAY_ALIASES: AliasMap = buildAliasMap([
  [['paymentId', 'payment_id', 'payment id', 'pay_id', 'razorpay_payment_id', 'razorpay payment id'], 'paymentId'],
  [['orderId', 'order_id', 'order id', 'razorpay_order_id', 'razorpay order id'], 'orderId'],
  [['settlementId', 'settlement_id', 'settlement id', 'setl_id', 'settlement'], 'settlementId'],
  [['status', 'payment_status', 'payment status', 'txn_status', 'txn status'], 'status'],
  [['amountPaise', 'amount_paise', 'amount paise', 'amount', 'gross_amount', 'gross amount'], 'amountPaise'],
  [['feePaise', 'fee_paise', 'fee paise', 'fee', 'fees', 'razorpay_fee', 'razorpay fee'], 'feePaise'],
  [['taxPaise', 'tax_paise', 'tax paise', 'tax', 'gst', 'service_tax', 'service tax'], 'taxPaise'],
  [['netPaise', 'net_paise', 'net paise', 'net_amount', 'net amount', 'settlement_amount', 'settlement amount'], 'netPaise'],
  [['createdAt', 'created_at', 'created at', 'payment_date', 'payment date', 'created'], 'createdAt'],
  [['settledAt', 'settled_at', 'settled at', 'settlement_date', 'settlement date', 'settled'], 'settledAt'],
  [['utr', 'utr_number', 'utr number', 'bank_reference', 'bank reference', 'bank_ref', 'neft_ref', 'rtgs_ref'], 'utr'],
]);

const BANK_ALIASES: AliasMap = buildAliasMap([
  [['bankRef', 'bank_ref', 'bank ref', 'bank_reference', 'bank reference', 'ref_no', 'reference_no', 'reference no', 'transaction_id', 'txn_id', 'chq_no', 'chqno'], 'bankRef'],
  [['type', 'txn_type', 'transaction_type', 'cr_dr', 'cr/dr', 'debit_credit', 'debit/credit'], 'type'],
  [['amountPaise', 'amount_paise', 'amount paise', 'amount', 'transaction_amount', 'txn_amount'], 'amountPaise'],
  [['date', 'txn_date', 'transaction_date', 'value_date', 'posting_date', 'book_date'], 'date'],
  [['valueDate', 'value_date', 'value date', 'clearing_date', 'clearing date', 'settlement_date'], 'valueDate'],
  [['utr', 'utr_number', 'utr no', 'utr_no', 'neft_ref', 'rtgs_ref', 'imps_ref', 'reference_number'], 'utr'],
  [['narration', 'description', 'remarks', 'particulars', 'details', 'desc', 'note'], 'narration'],
]);

function aliasMapForSource(source: ImportSource): AliasMap {
  switch (source) {
    case 'merchant': return MERCHANT_ALIASES;
    case 'razorpay': return RAZORPAY_ALIASES;
    case 'bank': return BANK_ALIASES;
  }
}

function requiredFieldsForSource(source: ImportSource): readonly string[] {
  switch (source) {
    case 'merchant': return MERCHANT_REQUIRED;
    case 'razorpay': return RAZORPAY_REQUIRED;
    case 'bank': return BANK_REQUIRED;
  }
}

// ============================================================
// Normalization
// ============================================================

/**
 * Converts a raw header to a canonical lookup key.
 * Collapses spaces, underscores, hyphens; lowercases; strips camelCase boundaries.
 *
 * e.g. "Payment ID" → "paymentid"
 *      "payment_id" → "paymentid"
 *      "paymentId"  → "paymentid"
 */
function canonicalize(header: string): string {
  return header
    .trim()
    // split camelCase: "paymentId" → "payment Id"
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // collapse separators
    .replace(/[\s_\-]+/g, '')
    .toLowerCase();
}

// ============================================================
// Main mapping function
// ============================================================

/**
 * Maps raw headers from a parsed file to logical field names for the given source.
 * Deterministic — same input always produces the same output.
 */
export function mapColumns(headers: string[], source: ImportSource): MappingResult {
  const aliases = aliasMapForSource(source);
  const required = requiredFieldsForSource(source);

  const mappedFields: Record<string, string> = {};
  const unknownHeaders: string[] = [];
  const warnings: string[] = [];

  for (const raw of headers) {
    const key = canonicalize(raw);
    const logical = aliases[key];
    if (logical) {
      mappedFields[raw] = logical;
    } else {
      unknownHeaders.push(raw);
    }
  }

  // Check required fields
  const mappedLogical = new Set(Object.values(mappedFields));
  const missingRequired = required.filter((f) => !mappedLogical.has(f));

  if (unknownHeaders.length > 0) {
    warnings.push(`Unknown headers (will be ignored): ${unknownHeaders.join(', ')}`);
  }

  return {
    detectedHeaders: headers,
    mappedFields,
    missingRequired,
    unknownHeaders,
    warnings,
  };
}

/**
 * Applies mapping to a ParsedRow, returning a new object keyed by logical field names.
 * Only mapped fields are included — unknown headers are dropped.
 */
export function applyMapping(row: ParsedRow, mappedFields: Record<string, string>): ParsedRow {
  const out: ParsedRow = {};
  for (const [rawHeader, logicalField] of Object.entries(mappedFields)) {
    if (rawHeader in row) {
      out[logicalField] = row[rawHeader];
    }
  }
  return out;
}
