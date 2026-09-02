/**
 * LedgerLens Database Schema (Drizzle ORM + SQLite)
 *
 * All monetary amounts are stored as INTEGER paise.
 * Raw source data is preserved in raw_json columns.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ============================================================
// import_batches — one record per file import
// ============================================================
export const importBatches = sqliteTable('import_batches', {
  id: text('id').primaryKey(),
  source: text('source', { enum: ['merchant', 'razorpay', 'bank'] }).notNull(),
  filename: text('filename').notNull(),
  format: text('format', { enum: ['csv', 'xlsx'] }).notNull(),
  sheetName: text('sheet_name'),
  status: text('status', { enum: ['preview', 'confirmed', 'failed'] }).notNull().default('preview'),
  totalRows: integer('total_rows').notNull().default(0),
  validRows: integer('valid_rows').notNull().default(0),
  invalidRows: integer('invalid_rows').notNull().default(0),
  warningsJson: text('warnings_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});


// ============================================================
// recon_runs — each reconciliation session
// ============================================================
export const reconRuns = sqliteTable('recon_runs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] })
    .notNull()
    .default('pending'),
  totalRecords: integer('total_records').notNull().default(0),
  matchedCount: integer('matched_count').notNull().default(0),
  unmatchedCount: integer('unmatched_count').notNull().default(0),
  exceptionCount: integer('exception_count').notNull().default(0),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
});

// ============================================================
// source_records — normalized records from all three sources
// ============================================================
export const sourceRecords = sqliteTable('source_records', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => reconRuns.id),
  /** Nullable — null for seeded/synthetic records, set for file-imported records. */
  importId: text('import_id').references(() => importBatches.id),
  source: text('source', { enum: ['merchant', 'razorpay', 'bank'] }).notNull(),
  externalRef: text('external_ref').notNull(),
  paymentRef: text('payment_ref').notNull().default(''),
  orderId: text('order_id').notNull().default(''),
  settlementRef: text('settlement_ref').notNull().default(''),
  utr: text('utr').notNull().default(''),
  amountPaise: integer('amount_paise').notNull(),
  feePaise: integer('fee_paise').notNull().default(0),
  taxPaise: integer('tax_paise').notNull().default(0),
  netPaise: integer('net_paise').notNull(),
  occurredAt: text('occurred_at').notNull(),
  settledAt: text('settled_at'),
  rawJson: text('raw_json').notNull(),
});

// ============================================================
// match_decisions — reconciliation matching results
// ============================================================
export const matchDecisions = sqliteTable('match_decisions', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => reconRuns.id),
  /** Comma-separated list of source_record IDs involved. */
  sourceRecordIds: text('source_record_ids').notNull(),
  status: text('status', {
    enum: ['matched', 'partial_match', 'unmatched', 'exception'],
  }).notNull(),
  /** Engine-level match type (e.g. "rule-fee-tax", "batch-settlement"). */
  matchType: text('match_type').notNull().default(''),
  confidence: integer('confidence').notNull().default(0),
  matchRule: text('match_rule').notNull(),
  differencesPaise: integer('differences_paise').notNull().default(0),
  explanation: text('explanation').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

// ============================================================
// exceptions — unresolved / investigated cases
// ============================================================
export const exceptions = sqliteTable('exceptions', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => reconRuns.id),
  matchDecisionId: text('match_decision_id').references(() => matchDecisions.id),
  sourceRecordIds: text('source_record_ids').notNull(),
  type: text('type').notNull(),
  severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).notNull(),
  amountPaise: integer('amount_paise').notNull(),
  /**
   * Priority score for human attention ordering.
   * ATTENTION-RANKING HEURISTIC ONLY — not financial correctness or risk probability.
   */
  priorityScore: integer('priority_score').notNull().default(0),
  description: text('description').notNull(),
  investigationResult: text('investigation_result', {
    enum: [
      'confirmed_match',
      'confirmed_mismatch',
      'needs_human_review',
      'insufficient_evidence',
    ],
  }),
  investigationReasoning: text('investigation_reasoning'),
  resolvedAt: text('resolved_at'),
  resolvedBy: text('resolved_by'),
  createdAt: text('created_at').notNull(),
});

// ============================================================
// audit_log — every financial decision is recorded
// ============================================================
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => reconRuns.id),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  performedBy: text('performed_by').notNull().default('system'),
  createdAt: text('created_at').notNull(),
});

// ============================================================
// ai_investigations — AI-assisted exception investigations
// ============================================================
export const aiInvestigations = sqliteTable('ai_investigations', {
  id: text('id').primaryKey(),
  exceptionId: text('exception_id')
    .notNull()
    .references(() => exceptions.id),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  verificationStatus: text('verification_status', {
    enum: ['AI_SUPPORTED', 'AI_REJECTED', 'INCONCLUSIVE', 'AI_UNAVAILABLE'],
  }).notNull(),
  verificationDetails: text('verification_details').notNull(),
  /** JSON-encoded AI output (conclusion, summary, candidateRecordIds, evidence, discrepancies, recommendedAction) */
  aiOutputJson: text('ai_output_json').notNull(),
  /** Comma-separated list of candidate record IDs considered */
  candidateRecordIds: text('candidate_record_ids').notNull(),
  tokensUsed: integer('tokens_used'),
  createdAt: text('created_at').notNull(),
});

// ============================================================
// llm_cache — cache LLM responses to avoid redundant calls
// ============================================================
export const llmCache = sqliteTable('llm_cache', {
  id: text('id').primaryKey(),
  promptHash: text('prompt_hash').notNull().unique(),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  tokensUsed: integer('tokens_used').notNull().default(0),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
});
