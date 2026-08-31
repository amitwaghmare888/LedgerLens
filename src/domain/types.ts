/**
 * LedgerLens Domain Types
 *
 * These are the core business types used across the application.
 * They are independent of the database schema (which mirrors but doesn't own them).
 */

// ============================================================
// Enums
// ============================================================

/** The source system a record originated from. */
export type RecordSource = 'merchant' | 'razorpay' | 'bank';

/** Transaction type in the merchant's books. */
export type MerchantTxnType = 'sale' | 'refund' | 'adjustment';

/** Status of a Razorpay payment (subset relevant to settlements). */
export type RazorpayPaymentStatus = 'captured' | 'refunded' | 'partially_refunded';

/** Bank statement entry type. */
export type BankEntryType = 'credit' | 'debit';

/** Reconciliation match status. */
export type MatchStatus = 'matched' | 'partial_match' | 'unmatched' | 'exception';

/** Investigation result (for future AI layer). */
export type InvestigationResult =
  | 'confirmed_match'
  | 'confirmed_mismatch'
  | 'needs_human_review'
  | 'insufficient_evidence';

/** Exception severity. */
export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';

// ============================================================
// Source Record Types
// ============================================================

/** A record from the merchant's accounting system. */
export interface MerchantRecord {
  /** Merchant's internal transaction ID. */
  merchantTxnId: string;
  /** Order or invoice reference. */
  orderRef: string;
  /** Payment gateway reference (may match Razorpay payment_id). */
  paymentRef: string;
  /** Customer identifier (masked or anonymized). */
  customerId: string;
  /** Transaction type. */
  type: MerchantTxnType;
  /** Gross amount in paise. */
  amountPaise: number;
  /** Transaction date. */
  date: Date;
  /** Free-text description/narration. */
  description: string;
}

/** A record from Razorpay settlement data. */
export interface RazorpaySettlementRecord {
  /** Razorpay payment ID (e.g. pay_XXXX). */
  paymentId: string;
  /** Razorpay order ID (e.g. order_XXXX). */
  orderId: string;
  /** Settlement ID (e.g. setl_XXXX). */
  settlementId: string;
  /** Payment status. */
  status: RazorpayPaymentStatus;
  /** Gross payment amount in paise. */
  amountPaise: number;
  /** Razorpay fee in paise. */
  feePaise: number;
  /** Tax (GST) on fee in paise. */
  taxPaise: number;
  /** Net settlement amount: amount - fee - tax, in paise. */
  netPaise: number;
  /** Payment creation timestamp. */
  createdAt: Date;
  /** Settlement timestamp (when funds were settled to bank). */
  settledAt: Date;
  /** UTR (Unique Transaction Reference) for the bank transfer. */
  utr: string;
}

/** A record from a bank statement. */
export interface BankStatementRecord {
  /** Bank's internal reference / transaction ID. */
  bankRef: string;
  /** Entry type: credit or debit. */
  type: BankEntryType;
  /** Amount in paise. */
  amountPaise: number;
  /** Transaction date. */
  date: Date;
  /** Value/settlement date. */
  valueDate: Date;
  /** UTR or reference number. */
  utr: string;
  /** Narration / description. */
  narration: string;
}

// ============================================================
// Normalized Record
// ============================================================

/**
 * A normalized record that allows uniform comparison across sources.
 * Created from any source record during the normalization phase.
 */
export interface NormalizedRecord {
  /** Internal ID (deterministic, prefixed). */
  id: string;
  /** Reconciliation run ID. */
  runId: string;
  /** Source system. */
  source: RecordSource;
  /** External reference (source system's own ID). */
  externalRef: string;
  /** Cross-reference to payment gateway (Razorpay payment_id or equivalent). */
  paymentRef: string;
  /** Settlement reference (Razorpay settlement_id). */
  settlementRef: string;
  /** UTR for bank matching. */
  utr: string;
  /** Gross amount in paise. */
  amountPaise: number;
  /** Fee in paise (0 for merchant/bank records). */
  feePaise: number;
  /** Tax in paise (0 for merchant/bank records). */
  taxPaise: number;
  /** Net amount in paise. */
  netPaise: number;
  /** When the transaction occurred. */
  occurredAt: Date;
  /** When it was settled (if applicable). */
  settledAt: Date | null;
  /** Original raw data as JSON string. */
  rawJson: string;
}

// ============================================================
// Reconciliation Types
// ============================================================

/** A match decision made by the reconciliation engine. */
export interface MatchDecision {
  id: string;
  runId: string;
  /** The record IDs involved in this match. */
  sourceRecordIds: string[];
  status: MatchStatus;
  /** Match confidence (0-100). Only set for partial matches. */
  confidence: number;
  /** Deterministic rule that produced this match (e.g. "exact-3way", "utr-match"). */
  matchRule: string;
  /** Amount difference in paise (0 for exact matches). */
  differencesPaise: number;
  /** Human-readable explanation. */
  explanation: string;
  createdAt: Date;
}

/** An exception requiring investigation. */
export interface Exception {
  id: string;
  runId: string;
  matchDecisionId: string | null;
  /** Record IDs related to this exception. */
  sourceRecordIds: string[];
  type: string;
  severity: ExceptionSeverity;
  /** Monetary impact in paise. */
  amountPaise: number;
  description: string;
  /** AI investigation result (null until investigated). */
  investigationResult: InvestigationResult | null;
  /** AI reasoning (null until investigated). */
  investigationReasoning: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
}

// ============================================================
// Ground Truth (for evaluation only — never used in production matching)
// ============================================================

/**
 * Ground truth label for a synthetic record.
 * This exists ONLY in the dataset generator and evaluation layer.
 * The reconciliation engine MUST NOT access this.
 */
export interface GroundTruth {
  /** The scenario that generated this case. */
  scenarioType: string;
  /** Expected match status. */
  expectedStatus: MatchStatus;
  /** IDs of records that should match together. */
  expectedMatchGroup: string[];
  /** Whether this is an adversarial trap. */
  isTrap: boolean;
  /** Human-readable description of the expected outcome. */
  expectedOutcome: string;
}

/**
 * A synthetic case with records and ground truth.
 */
export interface SyntheticCase {
  /** Scenario name (e.g. "clean-match", "fee-difference"). */
  scenario: string;
  /** Merchant records for this case. */
  merchantRecords: MerchantRecord[];
  /** Razorpay settlement records for this case. */
  razorpayRecords: RazorpaySettlementRecord[];
  /** Bank statement records for this case. */
  bankRecords: BankStatementRecord[];
  /** Ground truth — for evaluation only. */
  groundTruth: GroundTruth;
}
