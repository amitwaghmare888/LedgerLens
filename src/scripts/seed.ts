/**
 * LedgerLens Seed Script
 *
 * Generates the deterministic synthetic dataset and inserts it into the local SQLite database.
 * Run with: npm run seed
 *
 * The dataset is SYNTHETIC — it does not represent real Razorpay production data.
 * Fee rates, settlement timings, and other values are illustrative assumptions.
 */
import { initializeDatabase, getDb, getDbPath } from '../db';
import { sourceRecords, reconRuns, matchDecisions, exceptions, auditLog } from '../db/schema';
import { generateDataset } from '../dataset/generator';
import { deterministicId } from '../lib/deterministic';
import { validateSyntheticCase } from '../domain/invariants';
import type { NormalizedRecord } from '../domain/types';

const SEED = 42;
const RUN_ID = 'run_seed_dev';
const RUN_NAME = 'Development Seed (Synthetic)';
/** Deterministic timestamp for the seed run — not wall-clock time. */
const SEED_TIMESTAMP = '2025-01-01T00:00:00.000Z';

function normalizeRecords(dataset: ReturnType<typeof generateDataset>): NormalizedRecord[] {
  const records: NormalizedRecord[] = [];

  for (const c of dataset.cases) {
    // Normalize merchant records
    for (const m of c.merchantRecords) {
      records.push({
        id: deterministicId('src', m.merchantTxnId, 'merchant'),
        runId: RUN_ID,
        source: 'merchant',
        externalRef: m.merchantTxnId,
        paymentRef: m.paymentRef,
        orderId: m.orderRef,
        settlementRef: '',
        utr: '',
        amountPaise: m.amountPaise,
        feePaise: 0,
        taxPaise: 0,
        netPaise: m.amountPaise,
        occurredAt: m.date,
        settledAt: null,
        rawJson: JSON.stringify(m, (_key, value) =>
          value instanceof Date ? value.toISOString() : value
        ),
      });
    }

    // Normalize Razorpay records
    for (const rz of c.razorpayRecords) {
      records.push({
        id: deterministicId('src', rz.paymentId, 'razorpay'),
        runId: RUN_ID,
        source: 'razorpay',
        externalRef: rz.paymentId,
        paymentRef: rz.paymentId,
        orderId: rz.orderId,
        settlementRef: rz.settlementId,
        utr: rz.utr,
        amountPaise: rz.amountPaise,
        feePaise: rz.feePaise,
        taxPaise: rz.taxPaise,
        netPaise: rz.netPaise,
        occurredAt: rz.createdAt,
        settledAt: rz.settledAt,
        rawJson: JSON.stringify(rz, (_key, value) =>
          value instanceof Date ? value.toISOString() : value
        ),
      });
    }

    // Normalize bank records
    for (const b of c.bankRecords) {
      records.push({
        id: deterministicId('src', b.bankRef, 'bank'),
        runId: RUN_ID,
        source: 'bank',
        externalRef: b.bankRef,
        paymentRef: '',
        orderId: '',
        settlementRef: '',
        utr: b.utr,
        amountPaise: b.amountPaise,
        feePaise: 0,
        taxPaise: 0,
        netPaise: b.amountPaise,
        occurredAt: b.date,
        settledAt: b.valueDate,
        rawJson: JSON.stringify(b, (_key, value) =>
          value instanceof Date ? value.toISOString() : value
        ),
      });
    }
  }

  return records;
}

async function main() {
  console.log('=== LedgerLens Seed Script ===');
  console.log(`Database: ${getDbPath()}`);
  console.log(`Seed: ${SEED}`);
  console.log('');

  // 1. Initialize DB
  console.log('Initializing database...');
  initializeDatabase();

  // 2. Generate dataset
  console.log('Generating synthetic dataset...');
  const dataset = generateDataset(SEED);

  // 3. Validate all cases
  console.log('Validating financial invariants...');
  let validCount = 0;
  let errorCount = 0;
  for (const c of dataset.cases) {
    const result = validateSyntheticCase(c);
    if (result.valid) {
      validCount++;
    } else {
      errorCount++;
      console.error(`  INVALID: ${c.scenario}`, result.errors);
    }
  }
  console.log(`  ${validCount}/${dataset.cases.length} cases valid, ${errorCount} errors`);
  if (errorCount > 0) {
    console.error('Aborting seed: invalid cases found.');
    process.exit(1);
  }

  // 4. Normalize records
  console.log('Normalizing records...');
  const normalized = normalizeRecords(dataset);

  // 5. Clean existing seed data (makes `npm run seed` safely repeatable)
  console.log('Cleaning existing seed data...');
  const db = getDb();
  const { eq } = await import('drizzle-orm');
  db.delete(auditLog).where(eq(auditLog.runId, RUN_ID)).run();
  db.delete(exceptions).where(eq(exceptions.runId, RUN_ID)).run();
  db.delete(matchDecisions).where(eq(matchDecisions.runId, RUN_ID)).run();
  db.delete(sourceRecords).where(eq(sourceRecords.runId, RUN_ID)).run();
  db.delete(reconRuns).where(eq(reconRuns.id, RUN_ID)).run();

  // 6. Insert into database
  console.log('Inserting into database...');

  // Create the recon run (deterministic timestamp for reproducibility)
  db.insert(reconRuns)
    .values({
      id: RUN_ID,
      name: RUN_NAME,
      status: 'completed',
      totalRecords: normalized.length,
      matchedCount: 0,
      unmatchedCount: 0,
      exceptionCount: 0,
      createdAt: SEED_TIMESTAMP,
      completedAt: SEED_TIMESTAMP,
    })
    .run();

  // Insert records in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
    const batch = normalized.slice(i, i + BATCH_SIZE);
    db.insert(sourceRecords)
      .values(
        batch.map((r) => ({
          id: r.id,
          runId: r.runId,
          source: r.source as 'merchant' | 'razorpay' | 'bank',
          externalRef: r.externalRef,
          paymentRef: r.paymentRef,
          orderId: r.orderId,
          settlementRef: r.settlementRef,
          utr: r.utr,
          amountPaise: r.amountPaise,
          feePaise: r.feePaise,
          taxPaise: r.taxPaise,
          netPaise: r.netPaise,
          occurredAt: r.occurredAt.toISOString(),
          settledAt: r.settledAt?.toISOString() ?? null,
          rawJson: r.rawJson,
        }))
      )
      .run();
  }

  // 6. Save ground truth as JSON (for evaluation only, NOT used in reconciliation)
  const fs = await import('fs');
  const path = await import('path');
  const groundTruthPath = path.join(process.cwd(), 'data', 'ground-truth.json');
  const groundTruth = dataset.cases.map((c) => ({
    scenario: c.scenario,
    groundTruth: c.groundTruth,
  }));
  fs.writeFileSync(groundTruthPath, JSON.stringify(groundTruth, null, 2));

  // 7. Print summary
  console.log('');
  console.log('=== Seed Complete ===');
  console.log(`Total records: ${dataset.totalRecords}`);
  console.log(`  Merchant: ${dataset.totalMerchantRecords}`);
  console.log(`  Razorpay: ${dataset.totalRazorpayRecords}`);
  console.log(`  Bank:     ${dataset.totalBankRecords}`);
  console.log('');
  console.log('Scenario distribution:');
  for (const [scenario, count] of Object.entries(dataset.scenarioDistribution)) {
    console.log(`  ${scenario}: ${count} cases`);
  }
  console.log('');
  console.log(`Ground truth: ${groundTruthPath}`);
  console.log(`Database:     ${getDbPath()}`);
  console.log('');
  console.log('NOTE: This is SYNTHETIC data for development. Not real Razorpay production data.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
