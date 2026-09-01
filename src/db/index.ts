/**
 * Database connection singleton for LedgerLens.
 *
 * Uses better-sqlite3 for a local SQLite file.
 * In development, the DB file lives at ./data/ledgerlens.db.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.LEDGERLENS_DB_PATH || path.join(DB_DIR, 'ledgerlens.db');

/** Ensures the data directory exists. */
function ensureDataDir(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Returns the Drizzle database instance (creates if needed). */
export function getDb() {
  if (!_db) {
    ensureDataDir();
    const sqlite = new Database(DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

/** Creates all tables if they don't exist. Uses raw SQL for simplicity. */
export function initializeDatabase(): void {
  ensureDataDir();
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS recon_runs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_records INTEGER NOT NULL DEFAULT 0,
      matched_count INTEGER NOT NULL DEFAULT 0,
      unmatched_count INTEGER NOT NULL DEFAULT 0,
      exception_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS source_records (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES recon_runs(id),
      source TEXT NOT NULL,
      external_ref TEXT NOT NULL,
      payment_ref TEXT NOT NULL DEFAULT '',
      settlement_ref TEXT NOT NULL DEFAULT '',
      utr TEXT NOT NULL DEFAULT '',
      amount_paise INTEGER NOT NULL,
      fee_paise INTEGER NOT NULL DEFAULT 0,
      tax_paise INTEGER NOT NULL DEFAULT 0,
      net_paise INTEGER NOT NULL,
      occurred_at TEXT NOT NULL,
      settled_at TEXT,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_decisions (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES recon_runs(id),
      source_record_ids TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 0,
      match_rule TEXT NOT NULL,
      differences_paise INTEGER NOT NULL DEFAULT 0,
      explanation TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES recon_runs(id),
      match_decision_id TEXT REFERENCES match_decisions(id),
      source_record_ids TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      amount_paise INTEGER NOT NULL,
      description TEXT NOT NULL,
      investigation_result TEXT,
      investigation_reasoning TEXT,
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES recon_runs(id),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      performed_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_cache (
      id TEXT PRIMARY KEY,
      prompt_hash TEXT NOT NULL UNIQUE,
      model TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_source_records_run_id ON source_records(run_id);
    CREATE INDEX IF NOT EXISTS idx_source_records_source ON source_records(source);
    CREATE INDEX IF NOT EXISTS idx_source_records_payment_ref ON source_records(payment_ref);
    CREATE INDEX IF NOT EXISTS idx_source_records_utr ON source_records(utr);
    CREATE INDEX IF NOT EXISTS idx_match_decisions_run_id ON match_decisions(run_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_run_id ON exceptions(run_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_run_id ON audit_log(run_id);
    CREATE INDEX IF NOT EXISTS idx_llm_cache_prompt_hash ON llm_cache(prompt_hash);
  `);

  // ── Phase 2 column migrations (backward-compatible) ──────────────────────
  // SQLite does not support IF NOT EXISTS in ALTER TABLE.
  // We catch the "duplicate column" error to make this idempotent.
  function addColumnIfMissing(table: string, column: string, definition: string): void {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch {
      // Column already exists — expected on re-runs
    }
  }
  addColumnIfMissing('match_decisions', 'match_type', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('exceptions', 'priority_score', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('source_records', 'order_id', "TEXT NOT NULL DEFAULT ''");

  sqlite.close();
}

/** Returns the raw DB path for debugging/logging. */
export function getDbPath(): string {
  return DB_PATH;
}
