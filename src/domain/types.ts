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
  /** Order reference linking original sale to refund records. Empty for bank. */
  orderId: string;
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
  /**
   * Optional sub-group expectations for mixed cases (e.g. adjustment).
   * When present, each sub-group is evaluated independently.
   * externalRefs: source-system IDs (merchantTxnId / paymentId / bankRef)
   */
  expectedSubgroups?: Array<{
    externalRefs: string[];
    outcome: 'match' | 'exception';
  }>;
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

// ============================================================
// Phase 2 — Engine Types
// ============================================================

/**
 * Engine-internal reconciliation status.
 *
 * Distinct from the DB MatchStatus enum — do not collapse these.
 *
 * MATCHED    — a valid relationship is established by identifier evidence.
 * EXPLAINED  — a discrepancy is fully accounted for by verified arithmetic rule.
 * UNRESOLVED — no safe conclusion can be established; do not guess.
 */
export type ReconStatus = 'MATCHED' | 'EXPLAINED' | 'UNRESOLVED';

/**
 * Specific match rule that produced a decision.
 * Each type corresponds to one matching stage/rule.
 */
export type MatchType =
  | 'exact-payment-ref'      // Stage 1: merchant↔razorpay paymentRef
  | 'exact-utr'              // Stage 1: razorpay↔bank UTR
  | 'rule-fee-tax'           // Stage 2: gross/net reconciliation via fee+tax
  | 'rule-timing'            // Stage 2: UTR match with delayed settlement
  | 'rule-refund'            // Stage 2: original + refund group
  | 'rule-adjustment'        // Stage 2: adjustment without merchant counterpart
  | 'batch-settlement'       // Stage 3: N payments → one bank credit
  | 'unresolved';            // No stage produced a safe match

/**
 * Typed exception classifications.
 * Only assigned when evidence supports the specific type.
 */
export type ExceptionType =
  | 'MISSING_SETTLEMENT'    // merchant present, no razorpay
  | 'MISSING_BANK_ENTRY'    // merchant+razorpay, no bank record
  | 'AMOUNT_MISMATCH'       // linked by ID, but arithmetic fails
  | 'TIMING_MISMATCH'       // dates far out of plausible range
  | 'POSSIBLE_DUPLICATE'    // same paymentRef or UTR across independent groups
  | 'AMBIGUOUS_MATCH'       // multiple candidates, none decisive
  | 'UNSUPPORTED_CASE';     // evidence insufficient for any specific type

/**
 * An auditable event produced for every reconciliation decision.
 *
 * occurredAt is always derived from source record data — never from runtime Date.now().
 * This keeps audit events deterministic and reproducible.
 */
export interface AuditEvent {
  /** Reconciliation run this event belongs to. */
  runId: string;
  /** What kind of event this is. */
  eventType: 'match_decision' | 'exception_raised' | 'run_started' | 'run_completed';
  /** What domain entity is affected. */
  entityType: 'match_decision' | 'exception' | 'run';
  /** ID of the affected entity. */
  entityId: string;
  /** Reconciliation decision, or null for run lifecycle events. */
  decision: ReconStatus | null;
  /** Brief machine-readable reason key (e.g. "exact-payment-ref"). */
  reason: string;
  /** Human-readable explanation of WHY this decision was made. */
  evidence: string;
  /** ISO 8601 — derived from source data, not wall-clock time. */
  occurredAt: string;
}

/**
 * A Phase 2 match decision produced by the engine.
 * Extends the existing MatchDecision with engine-specific fields.
 */
export interface EngineMatchDecision {
  id: string;
  runId: string;
  sourceRecordIds: string[];
  status: ReconStatus;
  matchType: MatchType;
  /** Amount difference in paise between the matched records (0 for exact matches). */
  differencePaise: number;
  /** Human-readable explanation of WHY the match is valid. */
  evidence: string;
  createdAt: string;
}

/**
 * A Phase 2 exception produced by the engine.
 */
export interface EngineException {
  id: string;
  runId: string;
  sourceRecordIds: string[];
  type: ExceptionType;
  severity: ExceptionSeverity;
  amountPaise: number;
  description: string;
  /**
   * Priority score for human attention ordering.
   *
   * ATTENTION-RANKING HEURISTIC ONLY.
   * Does not determine financial correctness, risk probability, or match confidence.
   * Used solely to order the exception queue for human review.
   * Same input → same score, always.
   */
  priorityScore: number;
  createdAt: string;
}

/**
 * The complete output of one reconciliation engine run.
 *
 * The engine does NOT write to the database — callers handle persistence.
 * No React, no HTTP, no DB imports inside the engine.
 */
export interface EngineResult {
  runId: string;
  decisions: EngineMatchDecision[];
  exceptions: EngineException[];
  auditEvents: AuditEvent[];
}

/**
 * Per-scenario evaluation metrics.
 */
export interface ScenarioMetrics {
  scenario: string;
  totalCases: number;
  correctMatches: number;
  incorrectMatches: number;
  unresolvedCases: number;
  falseMatches: number;
  trapFalseMatches: number;
}

/**
 * Results of evaluating engine output against independent ground truth.
 *
 * Evaluation is case-level: each synthetic case is judged on:
 * 1. Whether the correct relationship was discovered (right records grouped).
 * 2. Whether the financial outcome was correctly classified (MATCHED/EXPLAINED/UNRESOLVED).
 * 3. Whether an unsafe match occurred (records from different true groups merged).
 *
 * isTrap and groundTruth are accessed ONLY in evaluate.ts — never in the engine.
 */
export interface EvaluationResult {
  /** Total synthetic cases evaluated. */
  totalCases: number;
  /** Engine grouped correctly AND status matches expected. */
  correctMatches: number;
  /** Engine grouped incorrectly OR status wrong. */
  incorrectMatches: number;
  /** Engine returned UNRESOLVED (correct when ground truth is also exception/unresolved). */
  unresolvedCases: number;
  /** precision = correctMatches / (correctMatches + incorrectMatches) */
  precision: number;
  /** recall = correctMatches / totalCases */
  recall: number;
  /** matchRate = (totalCases - unresolvedCases) / totalCases */
  matchRate: number;
  /** Cases where records from different true groups were incorrectly merged. */
  falseMatches: number;
  /** Subset of falseMatches where isTrap == true. */
  trapFalseMatches: number;
  /** Per-scenario breakdown. */
  byScenario: Record<string, ScenarioMetrics>;
}
