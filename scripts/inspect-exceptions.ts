/**
 * Inspect exception duplication in database
 */
import { getDb } from '../src/db';
import { exceptions, reconRuns } from '../src/db/schema';
import { sql } from 'drizzle-orm';

const db = getDb();

// Total exceptions
const totalExceptions = db.select({ count: sql<number>`count(*)` }).from(exceptions).all();
console.log('Total exception rows:', totalExceptions[0]?.count || 0);

// Exceptions by run
const byRun = db
  .select({
    runId: exceptions.runId,
    count: sql<number>`count(*)`,
  })
  .from(exceptions)
  .groupBy(exceptions.runId)
  .all();

console.log('\nExceptions by run:');
byRun.forEach((r) => console.log(`  ${r.runId}: ${r.count} exceptions`));

// Check for duplicate (runId + sourceRecordIds + type)
const duplicates = db
  .select({
    runId: exceptions.runId,
    sourceRecordIds: exceptions.sourceRecordIds,
    type: exceptions.type,
    count: sql<number>`count(*)`,
  })
  .from(exceptions)
  .groupBy(exceptions.runId, exceptions.sourceRecordIds, exceptions.type)
  .having(sql`count(*) > 1`)
  .all();

console.log('\nDuplicate logical exceptions (same runId + sourceRecordIds + type):');
if (duplicates.length === 0) {
  console.log('  None found');
} else {
  duplicates.forEach((d) => {
    console.log(`  runId=${d.runId}, sourceRecordIds=${d.sourceRecordIds}, type=${d.type}, count=${d.count}`);
  });
}

// Total runs
const totalRuns = db.select({ count: sql<number>`count(*)` }).from(reconRuns).all();
console.log('\nTotal reconciliation runs:', totalRuns[0]?.count || 0);

// Sample exceptions
const sample = db
  .select({
    id: exceptions.id,
    runId: exceptions.runId,
    type: exceptions.type,
    sourceRecordIds: exceptions.sourceRecordIds,
    amountPaise: exceptions.amountPaise,
  })
  .from(exceptions)
  .limit(10)
  .all();

console.log('\nSample exceptions (first 10):');
sample.forEach((e) => {
  console.log(`  ${e.id} | ${e.runId} | ${e.type} | ${e.sourceRecordIds} | ₹${(e.amountPaise / 100).toFixed(2)}`);
});
