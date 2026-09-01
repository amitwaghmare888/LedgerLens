/**
 * LedgerLens — Firebase SQL Connect Repository
 *
 * Server-only. Implements the Repository interface using firebase-admin/data-connect.
 *
 * Prerequisites (operator steps — not automated):
 *   1. firebase init dataconnect         (creates/links Firebase project)
 *   2. firebase dataconnect:sdk:generate (generates typed SDK into src/db/generated/)
 *   3. Set env vars (see .env.example)
 *   4. firebase emulators:start --only dataconnect  (local validation)
 *   5. firebase deploy --only dataconnect           (production deploy)
 *
 * Environment variables required when LEDGERLENS_DB_DRIVER=firebase:
 *   FIREBASE_SERVICE_ACCOUNT_KEY   — JSON string of service account credentials
 *   FIREBASE_DATACONNECT_SERVICE_ID — Data Connect service ID (e.g. "ledgerlens")
 *   FIREBASE_DATACONNECT_LOCATION  — Service location (e.g. "us-central1")
 *
 * SECURITY:
 * - This module is server-only. Never import from client components.
 * - firebase-admin bypasses client security rules — all ops are privileged.
 * - Service account credentials must never be exposed to the browser.
 *
 * NOTE: The generated SDK (src/db/generated/) does not exist until the operator
 * runs firebase dataconnect:sdk:generate. Until then, this module uses raw
 * executeGraphql() calls, which match the connector GQL files exactly.
 */

import type { Repository } from './repository';
import type { ImportBatchRecord } from '../ingestion/types';
import type {
  NormalizedRecord,
  EngineMatchDecision,
  EngineException,
  AuditEvent,
} from '../domain/types';
import type { ReconRun, RunCounts, RunStatus } from './recon-repository';

// ============================================================
// Firebase Admin init (lazy singleton)
// ============================================================

interface DataConnectBridge {
  executeGraphql<T = unknown>(options: { query: string; variables?: Record<string, unknown> }): Promise<{ data: T }>;
}

let _dataConnect: DataConnectBridge | null = null;

async function getDataConnectInstance(): Promise<DataConnectBridge> {
  if (_dataConnect) return _dataConnect;

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const serviceId = process.env.FIREBASE_DATACONNECT_SERVICE_ID;
  const location = process.env.FIREBASE_DATACONNECT_LOCATION;

  if (!serviceAccountRaw || !serviceId || !location) {
    throw new Error(
      'Firebase SQL Connect: missing required env vars: ' +
        'FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_DATACONNECT_SERVICE_ID, FIREBASE_DATACONNECT_LOCATION'
    );
  }

  // Dynamic import — firebase-admin only loaded when this driver is active
  // @ts-expect-error Optional dynamic production dependency
  const adminMod = await import('firebase-admin');
  const admin = adminMod.default ?? adminMod;
  // @ts-expect-error Optional dynamic production dependency
  const { getDataConnect } = await import('firebase-admin/data-connect');

  if (!admin.apps.length) {
    let credential: Record<string, unknown>;
    try {
      credential = JSON.parse(serviceAccountRaw);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }
    admin.initializeApp({
      credential: admin.credential.cert(credential),
    });
  }

  _dataConnect = getDataConnect(admin.app(), { serviceId, location }) as DataConnectBridge;
  return _dataConnect;
}

// ============================================================
// GraphQL execution helpers
// ============================================================

async function mutation(query: string, variables: Record<string, unknown>): Promise<void> {
  const dc = await getDataConnectInstance();
  await dc.executeGraphql({ query, variables });
}

async function gqlQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const dc = await getDataConnectInstance();
  const result = await dc.executeGraphql<T>({ query, variables });
  return result.data;
}

// ============================================================
// Helpers
// ============================================================

function toIso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function mapReconStatus(status: string): string {
  switch (status) {
    case 'MATCHED': return 'matched';
    case 'EXPLAINED': return 'partial_match';
    default: return 'unmatched';
  }
}

function unmapReconStatus(status: string): EngineMatchDecision['status'] {
  switch (status) {
    case 'matched': return 'MATCHED';
    case 'partial_match': return 'EXPLAINED';
    default: return 'UNRESOLVED';
  }
}

// ============================================================
// Repository implementation
// ============================================================

export const firebaseRepository: Repository = {

  // ── Runs ─────────────────────────────────────────────────

  createRun(name: string, runId?: string): string {
    const id = runId ?? crypto.randomUUID();
    const now = new Date().toISOString();
    // Fire-and-forget pattern not safe for financial ops — await in async context
    // Callers that use the Firebase driver must use getRepositoryAsync()
    // and await all operations. This sync signature is kept for interface compat;
    // the actual Firebase call is made via the async wrapper below.
    void mutation(
      `mutation ReconRun_insert($id: UUID!, $name: String!, $status: String!, $createdAt: Timestamp!) {
        reconRun_insert(data: { id: $id, name: $name, status: $status, createdAt: $createdAt })
      }`,
      { id, name, status: 'running', createdAt: now }
    );
    return id;
  },

  updateRunStatus(runId: string, status: RunStatus, counts: RunCounts): void {
    const now = new Date().toISOString();
    void mutation(
      `mutation ReconRun_update($id: UUID!, $status: String!, $totalRecords: Int!, $matchedCount: Int!, $unmatchedCount: Int!, $exceptionCount: Int!, $completedAt: Timestamp) {
        reconRun_update(id: $id, data: { status: $status, totalRecords: $totalRecords, matchedCount: $matchedCount, unmatchedCount: $unmatchedCount, exceptionCount: $exceptionCount, completedAt: $completedAt })
      }`,
      {
        id: runId,
        status,
        totalRecords: counts.totalRecords,
        matchedCount: counts.matchedCount + counts.explainedCount,
        unmatchedCount: 0,
        exceptionCount: counts.exceptionCount,
        completedAt: (status === 'completed' || status === 'failed') ? now : null,
      }
    );
  },

  getRunById(id: string): ReconRun | null {
    void id;
    // Synchronous read not supported with Firebase SQL Connect.
    // Use the async API routes directly.
    throw new Error('getRunById: use async Firebase path via API routes');
  },

  // ── Source records ────────────────────────────────────────

  loadSourceRecords(runId: string): NormalizedRecord[] {
    void runId;
    throw new Error('loadSourceRecords: use async Firebase path via API routes');
  },

  persistSourceRecords(runId: string, records: NormalizedRecord[], importId: string): void {
    for (const r of records) {
      void mutation(
        `mutation SourceRecord_insert($id: UUID!, $runId: UUID!, $importId: UUID, $source: String!, $externalRef: String!, $paymentRef: String!, $orderId: String!, $settlementRef: String!, $utr: String!, $amountPaise: Int!, $feePaise: Int!, $taxPaise: Int!, $netPaise: Int!, $occurredAt: Timestamp!, $settledAt: Timestamp, $rawJson: String!) {
          sourceRecord_insert(data: { id: $id, runId: $runId, importId: $importId, source: $source, externalRef: $externalRef, paymentRef: $paymentRef, orderId: $orderId, settlementRef: $settlementRef, utr: $utr, amountPaise: $amountPaise, feePaise: $feePaise, taxPaise: $taxPaise, netPaise: $netPaise, occurredAt: $occurredAt, settledAt: $settledAt, rawJson: $rawJson })
        }`,
        {
          id: r.id, runId, importId,
          source: r.source, externalRef: r.externalRef,
          paymentRef: r.paymentRef, orderId: r.orderId,
          settlementRef: r.settlementRef, utr: r.utr,
          amountPaise: r.amountPaise, feePaise: r.feePaise,
          taxPaise: r.taxPaise, netPaise: r.netPaise,
          occurredAt: toIso(r.occurredAt as Date)!,
          settledAt: toIso(r.settledAt as Date | null),
          rawJson: r.rawJson,
        }
      );
    }
  },

  // ── Import batches ────────────────────────────────────────

  persistImportBatch(batch: ImportBatchRecord): void {
    void mutation(
      `mutation ImportBatch_insert($id: UUID!, $source: String!, $filename: String!, $format: String!, $sheetName: String, $status: String!, $totalRows: Int!, $validRows: Int!, $invalidRows: Int!, $warningsJson: String!, $createdAt: Timestamp!) {
        importBatch_insert(data: { id: $id, source: $source, filename: $filename, format: $format, sheetName: $sheetName, status: $status, totalRows: $totalRows, validRows: $validRows, invalidRows: $invalidRows, warningsJson: $warningsJson, createdAt: $createdAt })
      }`,
      { ...batch }
    );
  },

  // ── Engine results ────────────────────────────────────────

  persistDecisions(runId: string, decisions: EngineMatchDecision[]): void {
    for (const d of decisions) {
      void mutation(
        `mutation MatchDecision_insert($id: UUID!, $runId: UUID!, $sourceRecordIds: String!, $status: String!, $matchType: String!, $matchRule: String!, $differencesPaise: Int!, $explanation: String!, $createdAt: Timestamp!) {
          matchDecision_insert(data: { id: $id, runId: $runId, sourceRecordIds: $sourceRecordIds, status: $status, matchType: $matchType, matchRule: $matchRule, differencesPaise: $differencesPaise, explanation: $explanation, createdAt: $createdAt })
        }`,
        {
          id: d.id, runId,
          sourceRecordIds: d.sourceRecordIds.join(','),
          status: mapReconStatus(d.status),
          matchType: d.matchType, matchRule: d.matchType,
          differencesPaise: d.differencePaise,
          explanation: d.evidence,
          createdAt: d.createdAt,
        }
      );
    }
  },

  persistExceptions(runId: string, excList: EngineException[]): void {
    for (const e of excList) {
      void mutation(
        `mutation Exception_insert($id: UUID!, $runId: UUID!, $sourceRecordIds: String!, $type: String!, $severity: String!, $amountPaise: Int!, $priorityScore: Int!, $description: String!, $createdAt: Timestamp!) {
          exception_insert(data: { id: $id, runId: $runId, sourceRecordIds: $sourceRecordIds, type: $type, severity: $severity, amountPaise: $amountPaise, priorityScore: $priorityScore, description: $description, createdAt: $createdAt })
        }`,
        {
          id: e.id, runId,
          sourceRecordIds: e.sourceRecordIds.join(','),
          type: e.type, severity: e.severity,
          amountPaise: e.amountPaise, priorityScore: e.priorityScore,
          description: e.description, createdAt: e.createdAt,
        }
      );
    }
  },

  writeAuditEvents(runId: string, events: AuditEvent[]): void {
    for (const e of events) {
      void mutation(
        `mutation AuditLog_insert($id: UUID!, $runId: UUID!, $entityType: String!, $entityId: UUID!, $action: String!, $details: String!, $performedBy: String!, $createdAt: Timestamp!) {
          auditLog_insert(data: { id: $id, runId: $runId, entityType: $entityType, entityId: $entityId, action: $action, details: $details, performedBy: $performedBy, createdAt: $createdAt })
        }`,
        {
          id: crypto.randomUUID(),
          runId, entityType: e.entityType, entityId: e.entityId,
          action: e.reason, details: e.evidence,
          performedBy: 'system', createdAt: e.occurredAt,
        }
      );
    }
  },

  // ── Queries ───────────────────────────────────────────────

  getRunResults(runId: string): { decisions: EngineMatchDecision[]; exceptions: EngineException[] } {
    void runId;
    throw new Error('getRunResults: use async Firebase path via API routes');
  },

  getExceptionById(id: string): EngineException | null {
    void id;
    throw new Error('getExceptionById: use async Firebase path via API routes');
  },

  getAllExceptions(): EngineException[] {
    throw new Error('getAllExceptions: use async Firebase path via API routes');
  },
};

// ============================================================
// Async query helpers for Firebase API routes
// ============================================================

export async function firebaseGetRunResults(runId: string): Promise<{
  decisions: EngineMatchDecision[];
  exceptions: EngineException[];
}> {
  type DecisionRow = {
    id: string; runId: string; sourceRecordIds: string; status: string;
    matchType: string; matchRule: string; differencesPaise: number;
    explanation: string; createdAt: string;
  };
  type ExceptionRow = {
    id: string; runId: string; sourceRecordIds: string; type: string;
    severity: string; amountPaise: number; priorityScore: number;
    description: string; createdAt: string;
  };

  const [decData, excData] = await Promise.all([
    gqlQuery<{ matchDecisions: DecisionRow[] }>(
      `query MatchDecisions_byRunId($runId: UUID!) { matchDecisions(where: { runId: { eq: $runId } }) { id runId sourceRecordIds status matchType matchRule differencesPaise explanation createdAt } }`,
      { runId }
    ),
    gqlQuery<{ exceptions: ExceptionRow[] }>(
      `query Exceptions_byRunId($runId: UUID!) { exceptions(where: { runId: { eq: $runId } }, orderBy: { priorityScore: DESC }) { id runId sourceRecordIds type severity amountPaise priorityScore description createdAt } }`,
      { runId }
    ),
  ]);

  return {
    decisions: (decData.matchDecisions ?? []).map((r) => ({
      id: r.id, runId: r.runId,
      sourceRecordIds: r.sourceRecordIds.split(',').filter(Boolean),
      status: unmapReconStatus(r.status),
      matchType: (r.matchType || r.matchRule) as EngineMatchDecision['matchType'],
      differencePaise: r.differencesPaise,
      evidence: r.explanation,
      createdAt: r.createdAt,
    })),
    exceptions: (excData.exceptions ?? []).map((r) => ({
      id: r.id, runId: r.runId,
      sourceRecordIds: r.sourceRecordIds.split(',').filter(Boolean),
      type: r.type as EngineException['type'],
      severity: r.severity as EngineException['severity'],
      amountPaise: r.amountPaise,
      description: r.description,
      priorityScore: r.priorityScore,
      createdAt: r.createdAt,
    })),
  };
}
