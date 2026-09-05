/**
 * Run reconciliation on seeded data
 */
import { initializeDatabase } from '../src/db';
import {
  createRun,
  loadSourceRecords,
  persistDecisions,
  persistExceptions,
  writeAuditEvents,
  updateRunStatus,
} from '../src/db/recon-repository';
import { runReconciliationEngine } from '../src/reconciliation/engine';

const SEED_RUN_ID = 'run_seed_dev';

initializeDatabase();

console.log('Running reconciliation on seeded data...');

// Load source records from the seeded run
const sourceRecords = loadSourceRecords(SEED_RUN_ID);
console.log(`Loaded ${sourceRecords.length} source records from ${SEED_RUN_ID}`);

if (sourceRecords.length === 0) {
  console.error('No source records found. Run `npm run seed` first.');
  process.exit(1);
}

// Create a new run
const runId = createRun('Test reconciliation');
console.log(`Created run: ${runId}`);

// Run the engine
const result = runReconciliationEngine(runId, sourceRecords);

console.log('\nEngine results:');
console.log(`  Decisions: ${result.decisions.length}`);
console.log(`    - Matched: ${result.decisions.filter((d) => d.status === 'MATCHED').length}`);
console.log(`    - Explained: ${result.decisions.filter((d) => d.status === 'EXPLAINED').length}`);
console.log(`  Exceptions: ${result.exceptions.length}`);
console.log(`  Audit events: ${result.auditEvents.length}`);

// Persist results
persistDecisions(runId, result.decisions);
persistExceptions(runId, result.exceptions);
writeAuditEvents(runId, result.auditEvents);

// Count by status
const matchedCount = result.decisions.filter((d) => d.status === 'MATCHED').length;
const explainedCount = result.decisions.filter((d) => d.status === 'EXPLAINED').length;
const exceptionCount = result.exceptions.length;

updateRunStatus(runId, 'completed', {
  totalRecords: sourceRecords.length,
  matchedCount,
  explainedCount,
  exceptionCount,
});

console.log('\nReconciliation complete!');
console.log(`Run ID: ${runId}`);
console.log(`Status: completed`);
