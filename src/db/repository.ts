/**
 * LedgerLens — Repository Router
 *
 * Single entry point for all persistence operations.
 * Selects the correct implementation based on LEDGERLENS_DB_DRIVER env var.
 *
 *   LEDGERLENS_DB_DRIVER=sqlite    → local SQLite (default)
 *   LEDGERLENS_DB_DRIVER=firebase  → Firebase SQL Connect (production)
 *
 * The reconciliation engine, API routes, and ingestion layer
 * call getRepository() — they never import a specific driver directly.
 *
 * Server-only: never import this from client components.
 */

import * as sqliteRepo from './recon-repository';
import type { ImportBatchRecord } from '../ingestion/types';
import type {
  NormalizedRecord,
  EngineMatchDecision,
  EngineException,
  AuditEvent,
} from '../domain/types';
import type { ReconRun, RunCounts, RunStatus } from './recon-repository';

// ============================================================
// Repository interface
// ============================================================

export interface Repository {
  // Runs
  createRun(name: string, runId?: string): string;
  updateRunStatus(runId: string, status: RunStatus, counts: RunCounts): void;
  getRunById(id: string): ReconRun | null;
  // Source records
  loadSourceRecords(runId: string): NormalizedRecord[];
  persistSourceRecords(runId: string, records: NormalizedRecord[], importId: string): void;
  // Import batches
  persistImportBatch(batch: ImportBatchRecord): void;
  // Engine results
  persistDecisions(runId: string, decisions: EngineMatchDecision[]): void;
  persistExceptions(runId: string, excList: EngineException[]): void;
  writeAuditEvents(runId: string, events: AuditEvent[]): void;
  // Queries
  getRunResults(runId: string): { decisions: EngineMatchDecision[]; exceptions: EngineException[] };
  getExceptionById(id: string): EngineException | null;
  getAllExceptions(): EngineException[];
}

// ============================================================
// SQLite implementation (wraps existing recon-repository)
// ============================================================

const sqliteRepository: Repository = {
  createRun: sqliteRepo.createRun,
  updateRunStatus: sqliteRepo.updateRunStatus,
  getRunById: sqliteRepo.getRunById,
  loadSourceRecords: sqliteRepo.loadSourceRecords,
  persistSourceRecords: sqliteRepo.persistSourceRecords,
  persistImportBatch: sqliteRepo.persistImportBatch,
  persistDecisions: sqliteRepo.persistDecisions,
  persistExceptions: sqliteRepo.persistExceptions,
  writeAuditEvents: sqliteRepo.writeAuditEvents,
  getRunResults: sqliteRepo.getRunResults,
  getExceptionById: sqliteRepo.getExceptionById,
  getAllExceptions: sqliteRepo.getAllExceptions,
};

// ============================================================
// Firebase SQL Connect implementation
// ============================================================

/**
 * Returns the Firebase SQL Connect repository.
 * Lazily imported so the firebase-admin module is only loaded
 * when LEDGERLENS_DB_DRIVER=firebase.
 */
async function loadFirebaseRepository(): Promise<Repository> {
  const mod = await import('./firebase-sql-connect');
  return mod.firebaseRepository;
}

// ============================================================
// Router
// ============================================================

const DRIVER = process.env.LEDGERLENS_DB_DRIVER ?? 'sqlite';

if (DRIVER !== 'sqlite' && DRIVER !== 'firebase') {
  throw new Error(
    `LEDGERLENS_DB_DRIVER must be "sqlite" or "firebase", got "${DRIVER}"`
  );
}

/**
 * Returns the active repository implementation.
 * For SQLite (default): synchronous, returns immediately.
 * For Firebase: async, returns a Promise.
 *
 * Usage (SQLite default, server-side):
 *   const repo = getRepository();
 *
 * Usage (Firebase, when LEDGERLENS_DB_DRIVER=firebase):
 *   const repo = await getRepositoryAsync();
 */
export function getRepository(): Repository {
  if (DRIVER === 'firebase') {
    throw new Error(
      'Firebase SQL Connect driver requires async init. Use getRepositoryAsync() instead.'
    );
  }
  return sqliteRepository;
}

export async function getRepositoryAsync(): Promise<Repository> {
  if (DRIVER === 'firebase') {
    return loadFirebaseRepository();
  }
  return sqliteRepository;
}
