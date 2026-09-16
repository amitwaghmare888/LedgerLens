/**
 * LedgerLens — Auto-seed for Vercel
 *
 * On Vercel, the SQLite DB starts empty on every cold start (because /tmp is ephemeral).
 * This module detects an empty DB and seeds it with the same deterministic synthetic
 * dataset that `npm run seed` would produce locally.
 *
 * Only runs when:
 *   1. process.env.VERCEL is set (i.e. running on Vercel), OR
 *   2. process.env.LEDGERLENS_AUTO_SEED=true (for testing)
 *   AND the DB has no source records yet.
 */

import type Database from 'better-sqlite3';

const SEED = 42;
const RUN_ID = 'run_seed_dev';
const RUN_NAME = 'Development Seed (Synthetic)';
const SEED_TIMESTAMP = '2025-01-01T00:00:00.000Z';

/** Returns true if the DB needs seeding (has no source records). */
function needsSeed(sqlite: InstanceType<typeof Database>): boolean {
  try {
    const row = sqlite.prepare('SELECT COUNT(*) as cnt FROM source_records').get() as { cnt: number };
    return row.cnt === 0;
  } catch {
    return true;
  }
}

/**
 * Seeds the database with synthetic data if it is empty.
 * Accepts the raw better-sqlite3 instance (not the Drizzle wrapper).
 */
export async function autoSeedIfEmpty(sqlite: InstanceType<typeof Database>): Promise<void> {
  const shouldAutoSeed = process.env.VERCEL || process.env.LEDGERLENS_AUTO_SEED === 'true';
  if (!shouldAutoSeed) return;
  if (!needsSeed(sqlite)) return;

  console.log('[auto-seed] Empty DB detected on Vercel — seeding synthetic data...');

  // Lazy-import heavy modules only when actually needed
  const { generateDataset } = await import('../dataset/generator');
  const { deterministicId } = await import('../lib/deterministic');

  const dataset = generateDataset(SEED);
  const BATCH_SIZE = 50;

  // Normalize all records
  const normalized: Array<{
    id: string; runId: string; source: string; externalRef: string;
    paymentRef: string; orderId: string; settlementRef: string; utr: string;
    amountPaise: number; feePaise: number; taxPaise: number; netPaise: number;
    occurredAt: string; settledAt: string | null; rawJson: string;
  }> = [];

  const toIso = (_key: string, value: unknown) =>
    value instanceof Date ? value.toISOString() : value;

  for (const c of dataset.cases) {
    for (const m of c.merchantRecords) {
      normalized.push({
        id: deterministicId('src', m.merchantTxnId, 'merchant'),
        runId: RUN_ID, source: 'merchant',
        externalRef: m.merchantTxnId, paymentRef: m.paymentRef,
        orderId: m.orderRef ?? '', settlementRef: '', utr: '',
        amountPaise: m.amountPaise, feePaise: 0, taxPaise: 0, netPaise: m.amountPaise,
        occurredAt: m.date instanceof Date ? m.date.toISOString() : String(m.date),
        settledAt: null,
        rawJson: JSON.stringify(m, toIso),
      });
    }
    for (const rz of c.razorpayRecords) {
      normalized.push({
        id: deterministicId('src', rz.paymentId, 'razorpay'),
        runId: RUN_ID, source: 'razorpay',
        externalRef: rz.paymentId, paymentRef: rz.paymentId,
        orderId: rz.orderId ?? '', settlementRef: rz.settlementId ?? '', utr: rz.utr ?? '',
        amountPaise: rz.amountPaise, feePaise: rz.feePaise ?? 0,
        taxPaise: rz.taxPaise ?? 0, netPaise: rz.netPaise,
        occurredAt: rz.createdAt instanceof Date ? rz.createdAt.toISOString() : String(rz.createdAt),
        settledAt: rz.settledAt instanceof Date ? rz.settledAt.toISOString() : (rz.settledAt ? String(rz.settledAt) : null),
        rawJson: JSON.stringify(rz, toIso),
      });
    }
    for (const b of c.bankRecords) {
      normalized.push({
        id: deterministicId('src', b.bankRef, 'bank'),
        runId: RUN_ID, source: 'bank',
        externalRef: b.bankRef, paymentRef: '', orderId: '', settlementRef: '', utr: b.utr ?? '',
        amountPaise: b.amountPaise, feePaise: 0, taxPaise: 0, netPaise: b.amountPaise,
        occurredAt: b.date instanceof Date ? b.date.toISOString() : String(b.date),
        settledAt: b.valueDate instanceof Date ? b.valueDate.toISOString() : (b.valueDate ? String(b.valueDate) : null),
        rawJson: JSON.stringify(b, toIso),
      });
    }
  }

  // Insert run
  sqlite.prepare(`
    INSERT OR IGNORE INTO recon_runs
      (id, name, status, total_records, matched_count, unmatched_count, exception_count, created_at, completed_at)
    VALUES (?, ?, 'completed', ?, 0, 0, 0, ?, ?)
  `).run(RUN_ID, RUN_NAME, normalized.length, SEED_TIMESTAMP, SEED_TIMESTAMP);

  // Insert records in batches using a prepared statement
  const insertRecord = sqlite.prepare(`
    INSERT OR IGNORE INTO source_records
      (id, run_id, source, external_ref, payment_ref, order_id, settlement_ref, utr,
       amount_paise, fee_paise, tax_paise, net_paise, occurred_at, settled_at, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = sqlite.transaction((batch: typeof normalized) => {
    for (const r of batch) {
      insertRecord.run(
        r.id, r.runId, r.source, r.externalRef, r.paymentRef, r.orderId,
        r.settlementRef, r.utr, r.amountPaise, r.feePaise, r.taxPaise,
        r.netPaise, r.occurredAt, r.settledAt, r.rawJson,
      );
    }
  });

  for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
    insertBatch(normalized.slice(i, i + BATCH_SIZE));
  }

  console.log(`[auto-seed] Done — inserted ${normalized.length} records into ${RUN_ID}.`);
}
