import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { generateDataset } from '../dataset/generator';
import { deterministicId } from '../lib/deterministic';
import type { NormalizedRecord } from '../domain/types';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-seed.db');
const RUN_ID = 'run_seed_dev';
const SEED = 42;
const SEED_TIMESTAMP = '2025-01-01T00:00:00.000Z';

const DDL = `
  CREATE TABLE IF NOT EXISTS recon_runs (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    total_records INTEGER NOT NULL DEFAULT 0, matched_count INTEGER NOT NULL DEFAULT 0,
    unmatched_count INTEGER NOT NULL DEFAULT 0, exception_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS source_records (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES recon_runs(id),
    source TEXT NOT NULL, external_ref TEXT NOT NULL,
    payment_ref TEXT NOT NULL DEFAULT '', order_id TEXT NOT NULL DEFAULT '',
    settlement_ref TEXT NOT NULL DEFAULT '',
    utr TEXT NOT NULL DEFAULT '', amount_paise INTEGER NOT NULL,
    fee_paise INTEGER NOT NULL DEFAULT 0, tax_paise INTEGER NOT NULL DEFAULT 0,
    net_paise INTEGER NOT NULL, occurred_at TEXT NOT NULL,
    settled_at TEXT, raw_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS match_decisions (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES recon_runs(id),
    source_record_ids TEXT NOT NULL, status TEXT NOT NULL,
    confidence INTEGER NOT NULL DEFAULT 0, match_rule TEXT NOT NULL,
    differences_paise INTEGER NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exceptions (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES recon_runs(id),
    match_decision_id TEXT REFERENCES match_decisions(id),
    source_record_ids TEXT NOT NULL, type TEXT NOT NULL,
    severity TEXT NOT NULL, amount_paise INTEGER NOT NULL,
    description TEXT NOT NULL, investigation_result TEXT,
    investigation_reasoning TEXT, resolved_at TEXT,
    resolved_by TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES recon_runs(id),
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
    action TEXT NOT NULL, details TEXT NOT NULL,
    performed_by TEXT NOT NULL DEFAULT 'system', created_at TEXT NOT NULL
  );
`;

function normalizeDataset(dataset: ReturnType<typeof generateDataset>): NormalizedRecord[] {
  const records: NormalizedRecord[] = [];
  for (const c of dataset.cases) {
    for (const m of c.merchantRecords) {
      records.push({
        id: deterministicId('src', m.merchantTxnId, 'merchant'),
        runId: RUN_ID, source: 'merchant', externalRef: m.merchantTxnId,
        paymentRef: m.paymentRef, orderId: m.orderRef, settlementRef: '', utr: '',
        amountPaise: m.amountPaise, feePaise: 0, taxPaise: 0, netPaise: m.amountPaise,
        occurredAt: m.date, settledAt: null,
        rawJson: JSON.stringify(m, (_k, v) => v instanceof Date ? v.toISOString() : v),
      });
    }
    for (const rz of c.razorpayRecords) {
      records.push({
        id: deterministicId('src', rz.paymentId, 'razorpay'),
        runId: RUN_ID, source: 'razorpay', externalRef: rz.paymentId,
        paymentRef: rz.paymentId, orderId: rz.orderId, settlementRef: rz.settlementId, utr: rz.utr,
        amountPaise: rz.amountPaise, feePaise: rz.feePaise, taxPaise: rz.taxPaise,
        netPaise: rz.netPaise, occurredAt: rz.createdAt, settledAt: rz.settledAt,
        rawJson: JSON.stringify(rz, (_k, v) => v instanceof Date ? v.toISOString() : v),
      });
    }
    for (const b of c.bankRecords) {
      records.push({
        id: deterministicId('src', b.bankRef, 'bank'),
        runId: RUN_ID, source: 'bank', externalRef: b.bankRef,
        paymentRef: '', orderId: '', settlementRef: '', utr: b.utr,
        amountPaise: b.amountPaise, feePaise: 0, taxPaise: 0, netPaise: b.amountPaise,
        occurredAt: b.date, settledAt: b.valueDate,
        rawJson: JSON.stringify(b, (_k, v) => v instanceof Date ? v.toISOString() : v),
      });
    }
  }
  return records;
}

function seedIntoDb(
  db: ReturnType<typeof drizzle<typeof schema>>,
  records: NormalizedRecord[]
) {
  // Clean existing seed data
  db.delete(schema.auditLog).where(eq(schema.auditLog.runId, RUN_ID)).run();
  db.delete(schema.exceptions).where(eq(schema.exceptions.runId, RUN_ID)).run();
  db.delete(schema.matchDecisions).where(eq(schema.matchDecisions.runId, RUN_ID)).run();
  db.delete(schema.sourceRecords).where(eq(schema.sourceRecords.runId, RUN_ID)).run();
  db.delete(schema.reconRuns).where(eq(schema.reconRuns.id, RUN_ID)).run();

  // Insert run
  db.insert(schema.reconRuns).values({
    id: RUN_ID, name: 'Test', status: 'completed',
    totalRecords: records.length, matchedCount: 0, unmatchedCount: 0, exceptionCount: 0,
    createdAt: SEED_TIMESTAMP, completedAt: SEED_TIMESTAMP,
  }).run();

  // Insert records
  const BATCH = 50;
  for (let i = 0; i < records.length; i += BATCH) {
    db.insert(schema.sourceRecords).values(
      records.slice(i, i + BATCH).map((r) => ({
        id: r.id, runId: r.runId,
        source: r.source as 'merchant' | 'razorpay' | 'bank',
        externalRef: r.externalRef, paymentRef: r.paymentRef,
        orderId: r.orderId,
        settlementRef: r.settlementRef, utr: r.utr,
        amountPaise: r.amountPaise, feePaise: r.feePaise,
        taxPaise: r.taxPaise, netPaise: r.netPaise,
        occurredAt: r.occurredAt.toISOString(),
        settledAt: r.settledAt?.toISOString() ?? null,
        rawJson: r.rawJson,
      }))
    ).run();
  }
}

describe('seed integration', () => {
  let sqlite: InstanceType<typeof Database>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(() => {
    // Use in-memory DB to avoid file lock issues
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(DDL);
    db = drizzle(sqlite, { schema });
  });

  afterEach(() => {
    sqlite.close();
  });

  it('seed inserts correctly on first run', () => {
    const dataset = generateDataset(SEED);
    const records = normalizeDataset(dataset);
    seedIntoDb(db, records);

    const rows = db.select().from(schema.sourceRecords).all();
    expect(rows.length).toBe(dataset.totalRecords);
  });

  it('seed succeeds on second run without duplicate key errors', () => {
    const dataset = generateDataset(SEED);
    const records = normalizeDataset(dataset);

    seedIntoDb(db, records);
    const rows1 = db.select().from(schema.sourceRecords).all();

    // Second run must not throw
    expect(() => seedIntoDb(db, records)).not.toThrow();
    const rows2 = db.select().from(schema.sourceRecords).all();

    expect(rows2.length).toBe(rows1.length);
    expect(rows2.length).toBe(dataset.totalRecords);
  });

  it('no duplicate records after repeated seeding', () => {
    const dataset = generateDataset(SEED);
    const records = normalizeDataset(dataset);

    seedIntoDb(db, records);
    seedIntoDb(db, records);
    seedIntoDb(db, records);

    const rows = db.select().from(schema.sourceRecords).all();
    expect(rows.length).toBe(dataset.totalRecords);

    const runs = db.select().from(schema.reconRuns).all();
    expect(runs.length).toBe(1);
  });

  it('persisted seed metadata uses deterministic timestamp', () => {
    const dataset = generateDataset(SEED);
    const records = normalizeDataset(dataset);
    seedIntoDb(db, records);

    const runs = db.select().from(schema.reconRuns).all();
    expect(runs.length).toBe(1);
    expect(runs[0].createdAt).toBe(SEED_TIMESTAMP);
    expect(runs[0].completedAt).toBe(SEED_TIMESTAMP);
  });

  it('deterministic seed data: same records after re-seed', () => {
    const dataset = generateDataset(SEED);
    const records = normalizeDataset(dataset);

    seedIntoDb(db, records);
    const rows1 = db.select().from(schema.sourceRecords).all();
    const ids1 = rows1.map((r) => r.id).sort();
    const amounts1 = rows1.map((r) => r.amountPaise).sort((a, b) => a - b);

    // Re-seed
    seedIntoDb(db, records);
    const rows2 = db.select().from(schema.sourceRecords).all();
    const ids2 = rows2.map((r) => r.id).sort();
    const amounts2 = rows2.map((r) => r.amountPaise).sort((a, b) => a - b);

    expect(ids1).toEqual(ids2);
    expect(amounts1).toEqual(amounts2);
  });
});
