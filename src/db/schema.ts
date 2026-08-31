/**
 * LedgerLens Database Schema (Drizzle ORM + SQLite)
 *
 * All monetary amounts are stored as INTEGER paise.
 * Raw source data is preserved in raw_json columns.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
  source: text('source', { enum: ['merchant', 'razorpay', 'bank'] }).notNull(),
  externalRef: text('external_ref').notNull(),
  paymentRef: text('payment_ref').notNull().default(''),
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
