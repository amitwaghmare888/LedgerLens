/**
 * LedgerLens — Reconciliation Repository
 *
 * Pure persistence layer. No engine logic. No HTTP. No React.
 *
 * Responsible for:
 * - Creating reconciliation runs
 * - Loading source records
 * - Persisting engine results (decisions, exceptions, audit events)
 * - Querying run/exception data for API routes
 *
 * The data-flow boundary is strictly enforced:
 *   repository → NormalizedRecord[] → engine → EngineResult → repository (persist)
 */
import { getDb } from './index';
import {
  reconRuns,
  sourceRecords,
  matchDecisions,
  exceptions,
  auditLog,
  importBatches,
  aiInvestigations,
} from './schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { deterministicId } from '../lib/deterministic';
import { normalizeFromDbRows } from '../reconciliation/normalize';
import type {
  NormalizedRecord,
  EngineMatchDecision,
  EngineException,
  AuditEvent,
} from '../domain/types';

// ============================================================
// Types
// ============================================================

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface RunCounts {
  totalRecords: number;
  matchedCount: number;
  explainedCount: number;
  exceptionCount: number;
}

export interface ReconRun {
  id: string;
  name: string;
  status: RunStatus;
  totalRecords: number;
  matchedCount: number;
  explainedCount: number;
  exceptionCount: number;
  createdAt: string;
  completedAt: string | null;
}

// ============================================================
// Run lifecycle
// ============================================================

/**
 * Creates a new reconciliation run record and returns the run ID.
 * Runtime timestamp used ONLY for the run record (not for financial data).
 */
export function createRun(name: string, runId?: string): string {
  const db = getDb();
  const id = runId ?? deterministicId('run', Date.now(), Math.random().toString());
  const now = new Date().toISOString();
  db.insert(reconRuns)
    .values({
      id,
      name,
      status: 'running',
      totalRecords: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      exceptionCount: 0,
      createdAt: now,
    })
    .run();
  return id;
}

/**
 * Updates a run's status and final counts.
 */
export function updateRunStatus(
  runId: string,
  status: RunStatus,
  counts: RunCounts
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.update(reconRuns)
    .set({
      status,
      totalRecords: counts.totalRecords,
      matchedCount: counts.matchedCount + counts.explainedCount,
      unmatchedCount: 0,
      exceptionCount: counts.exceptionCount,
      completedAt: status === 'completed' || status === 'failed' ? now : null,
    })
    .where(eq(reconRuns.id, runId))
    .run();
}

/**
 * Returns a run by ID, or null if not found.
 */
export function getRunById(id: string): ReconRun | null {
  const db = getDb();
  const rows = db.select().from(reconRuns).where(eq(reconRuns.id, id)).all();
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    status: row.status as RunStatus,
    totalRecords: row.totalRecords,
    matchedCount: row.matchedCount,
    explainedCount: 0, // derived from match_type in a real query
    exceptionCount: row.exceptionCount,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
  };
}

// ============================================================
// Source records
// ============================================================

/**
 * Loads all source records for a run and returns them as NormalizedRecord[].
 */
export function loadSourceRecords(runId: string): NormalizedRecord[] {
  const db = getDb();
  const rows = db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.runId, runId))
    .all();
  return normalizeFromDbRows(rows);
}

// ============================================================
// Import batch persistence
// ============================================================

/**
 * Persists an import batch record (one per file upload, status = 'confirmed').
 * Returns the batch ID.
 */
export function persistImportBatch(batch: import('../ingestion/types').ImportBatchRecord): void {
  const db = getDb();
  db.insert(importBatches)
    .values({
      id: batch.id,
      source: batch.source,
      filename: batch.filename,
      format: batch.format,
      sheetName: batch.sheetName,
      status: batch.status,
      totalRows: batch.totalRows,
      validRows: batch.validRows,
      invalidRows: batch.invalidRows,
      warningsJson: batch.warningsJson,
      createdAt: batch.createdAt,
    })
    .run();
}

/**
 * Persists validated NormalizedRecords to source_records with provenance.
 * Associates each record with the given importId.
 */
export function persistSourceRecords(
  runId: string,
  records: NormalizedRecord[],
  importId: string
): void {
  if (records.length === 0) return;
  const db = getDb();
  const BATCH = 50;
  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH);
    db.insert(sourceRecords)
      .values(
        slice.map((r) => ({
          id: r.id,
          runId,
          importId,
          source: r.source,
          externalRef: r.externalRef,
          paymentRef: r.paymentRef,
          orderId: r.orderId,
          settlementRef: r.settlementRef,
          utr: r.utr,
          amountPaise: r.amountPaise,
          feePaise: r.feePaise,
          taxPaise: r.taxPaise,
          netPaise: r.netPaise,
          occurredAt: r.occurredAt instanceof Date ? r.occurredAt.toISOString() : r.occurredAt,
          settledAt: r.settledAt instanceof Date ? r.settledAt.toISOString() : r.settledAt ?? null,
          rawJson: r.rawJson,
        }))
      )
      .run();
  }
}


const BATCH_SIZE = 50;

/**
 * Persists match decisions to the database.
 */
export function persistDecisions(
  runId: string,
  decisions: EngineMatchDecision[]
): void {
  if (decisions.length === 0) return;
  const db = getDb();

  for (let i = 0; i < decisions.length; i += BATCH_SIZE) {
    const batch = decisions.slice(i, i + BATCH_SIZE);
    db.insert(matchDecisions)
      .values(
        batch.map((d) => ({
          id: d.id,
          runId,
          sourceRecordIds: d.sourceRecordIds.join(','),
          status: mapReconStatus(d.status),
          matchType: d.matchType,
          confidence: 0, // Not used for deterministic matches
          matchRule: d.matchType,
          differencesPaise: d.differencePaise,
          explanation: d.evidence,
          createdAt: d.createdAt,
        }))
      )
      .run();
  }
}

function mapReconStatus(status: string): 'matched' | 'partial_match' | 'unmatched' | 'exception' {
  switch (status) {
    case 'MATCHED': return 'matched';
    case 'EXPLAINED': return 'partial_match';
    default: return 'unmatched';
  }
}

/**
 * Persists exceptions to the database.
 */
export function persistExceptions(
  runId: string,
  excList: EngineException[]
): void {
  if (excList.length === 0) return;
  const db = getDb();

  for (let i = 0; i < excList.length; i += BATCH_SIZE) {
    const batch = excList.slice(i, i + BATCH_SIZE);
    db.insert(exceptions)
      .values(
        batch.map((e) => ({
          id: e.id,
          runId,
          matchDecisionId: null,
          sourceRecordIds: e.sourceRecordIds.join(','),
          type: e.type,
          severity: e.severity,
          amountPaise: e.amountPaise,
          priorityScore: e.priorityScore,
          description: e.description,
          createdAt: e.createdAt,
        }))
      )
      .run();
  }
}

/**
 * Persists audit events to the database.
 */
export function writeAuditEvents(
  runId: string,
  events: AuditEvent[]
): void {
  if (events.length === 0) return;
  const db = getDb();

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    db.insert(auditLog)
      .values(
        batch.map((e) => ({
          id: deterministicId('audit', runId, e.entityId, e.eventType),
          runId,
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.reason,
          details: e.evidence,
          performedBy: 'system',
          createdAt: e.occurredAt,
        }))
      )
      .run();
  }
}

// ============================================================
// Query results
// ============================================================

/**
 * Returns all decisions and exceptions for a run.
 */
export function getRunResults(runId: string): {
  decisions: EngineMatchDecision[];
  exceptions: EngineException[];
} {
  const db = getDb();

  const decisionRows = db
    .select()
    .from(matchDecisions)
    .where(eq(matchDecisions.runId, runId))
    .all();

  const exceptionRows = db
    .select()
    .from(exceptions)
    .where(eq(exceptions.runId, runId))
    .orderBy(desc(exceptions.priorityScore))
    .all();

  return {
    decisions: decisionRows.map((r) => ({
      id: r.id,
      runId: r.runId,
      sourceRecordIds: r.sourceRecordIds.split(',').filter(Boolean),
      status: unmapReconStatus(r.status),
      matchType: (r.matchType || r.matchRule) as EngineMatchDecision['matchType'],
      differencePaise: r.differencesPaise,
      evidence: r.explanation,
      createdAt: r.createdAt,
    })),
    exceptions: exceptionRows.map((r) => ({
      id: r.id,
      runId: r.runId,
      sourceRecordIds: r.sourceRecordIds.split(',').filter(Boolean),
      type: r.type as EngineException['type'],
      severity: r.severity as EngineException['severity'],
      amountPaise: r.amountPaise,
      description: r.description,
      priorityScore: r.priorityScore ?? 0,
      createdAt: r.createdAt,
    })),
  };
}

function unmapReconStatus(status: string): EngineMatchDecision['status'] {
  switch (status) {
    case 'matched': return 'MATCHED';
    case 'partial_match': return 'EXPLAINED';
    default: return 'UNRESOLVED';
  }
}

/**
 * Returns a single exception by ID, or null.
 */
export function getExceptionById(id: string): EngineException | null {
  const db = getDb();
  const rows = db.select().from(exceptions).where(eq(exceptions.id, id)).all();
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    runId: r.runId,
    sourceRecordIds: r.sourceRecordIds.split(',').filter(Boolean),
    type: r.type as EngineException['type'],
    severity: r.severity as EngineException['severity'],
    amountPaise: r.amountPaise,
    description: r.description,
    priorityScore: r.priorityScore ?? 0,
    createdAt: r.createdAt,
  };
}

/**
 * Returns normalized source records by their IDs.
 */
export function getSourceRecordsByIds(ids: string[]): NormalizedRecord[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = db
    .select()
    .from(sourceRecords)
    .where(inArray(sourceRecords.id, ids))
    .all();
  return normalizeFromDbRows(rows);
}

/**
 * Returns a single exception with its associated audit trail and source records.
 */
export function getExceptionWithAudit(
  id: string
): { exception: EngineException; sourceRecords: NormalizedRecord[]; auditEvents: AuditEvent[] } | null {
  const exc = getExceptionById(id);
  if (!exc) return null;

  const db = getDb();
  const auditRows = db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entityId, id))
    .all();

  const sourceRecs = getSourceRecordsByIds(exc.sourceRecordIds);

  const auditEvents: AuditEvent[] = auditRows.map((r) => ({
    runId: r.runId,
    eventType: 'exception_raised',
    entityType: 'exception',
    entityId: r.entityId,
    decision: null,
    reason: r.action,
    evidence: r.details,
    occurredAt: r.createdAt,
  }));

  return { exception: exc, sourceRecords: sourceRecs, auditEvents };
}

/**
 * Returns all exceptions across all runs, sorted by priority score descending.
 * For listing the exception queue.
 */
export function getAllExceptions(): EngineException[] {
  const db = getDb();
  const rows = db
    .select()
    .from(exceptions)
    .orderBy(desc(exceptions.priorityScore))
    .all();
  return rows.map((r) => ({
    id: r.id,
    runId: r.runId,
    sourceRecordIds: r.sourceRecordIds.split(',').filter(Boolean),
    type: r.type as EngineException['type'],
    severity: r.severity as EngineException['severity'],
    amountPaise: r.amountPaise,
    description: r.description,
    priorityScore: r.priorityScore ?? 0,
    createdAt: r.createdAt,
  }));
}

/**
 * Returns persisted audit log events across all runs.
 */
export function getAllAuditEvents(limit = 200): Array<{
  id: string;
  runId: string;
  entityType: string;
  entityId: string;
  action: string;
  details: string;
  performedBy: string;
  createdAt: string;
}> {
  const db = getDb();
  return db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .all();
}

// ============================================================
// AI Investigations
// ============================================================

/**
 * Persists an AI investigation result.
 */
export async function persistInvestigation(
  result: import('../ai/response-schema').InvestigationResult
): Promise<void> {
  const db = getDb();
  const id = deterministicId('ai-inv', result.exceptionId, result.timestamp);

  db.insert(aiInvestigations)
    .values({
      id,
      exceptionId: result.exceptionId,
      provider: result.provider,
      model: result.model,
      verificationStatus: result.verificationStatus,
      verificationDetails: result.verificationDetails,
      aiOutputJson: JSON.stringify(result.aiOutput),
      candidateRecordIds: result.aiOutput.candidateRecordIds.join(','),
      tokensUsed: result.tokensUsed ?? null,
      createdAt: result.timestamp,
    })
    .run();
}

/**
 * Returns the most recent AI investigation for an exception, or null.
 */
export function getLatestInvestigation(
  exceptionId: string
): import('../ai/response-schema').InvestigationResult | null {
  const db = getDb();
  const rows = db
    .select()
    .from(aiInvestigations)
    .where(eq(aiInvestigations.exceptionId, exceptionId))
    .orderBy(desc(aiInvestigations.createdAt))
    .limit(1)
    .all();

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    exceptionId: row.exceptionId,
    provider: row.provider,
    model: row.model,
    aiOutput: JSON.parse(row.aiOutputJson),
    verificationStatus: row.verificationStatus as import('../ai/response-schema').InvestigationResult['verificationStatus'],
    verificationDetails: row.verificationDetails,
    timestamp: row.createdAt,
    tokensUsed: row.tokensUsed ?? undefined,
  };
}

/**
 * Returns all AI investigations for an exception.
 */
export function getAllInvestigations(
  exceptionId: string
): Array<import('../ai/response-schema').InvestigationResult> {
  const db = getDb();
  const rows = db
    .select()
    .from(aiInvestigations)
    .where(eq(aiInvestigations.exceptionId, exceptionId))
    .orderBy(desc(aiInvestigations.createdAt))
    .all();

  return rows.map((row) => ({
    exceptionId: row.exceptionId,
    provider: row.provider,
    model: row.model,
    aiOutput: JSON.parse(row.aiOutputJson),
    verificationStatus: row.verificationStatus as import('../ai/response-schema').InvestigationResult['verificationStatus'],
    verificationDetails: row.verificationDetails,
    timestamp: row.createdAt,
    tokensUsed: row.tokensUsed ?? undefined,
  }));
}

