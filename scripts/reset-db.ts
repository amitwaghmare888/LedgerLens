/**
 * Reset database - delete all reconciliation runs and related data
 */
import { getDb } from '../src/db';
import { reconRuns, sourceRecords, matchDecisions, exceptions, auditLog, aiInvestigations } from '../src/db/schema';
import { sql } from 'drizzle-orm';

const db = getDb();

console.log('Resetting database...');

// Delete in dependency order
db.delete(aiInvestigations).run();
console.log('✓ Deleted AI investigations');

db.delete(auditLog).run();
console.log('✓ Deleted audit log');

db.delete(exceptions).run();
console.log('✓ Deleted exceptions');

db.delete(matchDecisions).run();
console.log('✓ Deleted match decisions');

db.delete(sourceRecords).run();
console.log('✓ Deleted source records');

db.delete(reconRuns).run();
console.log('✓ Deleted reconciliation runs');

// Verify
const runCount = db.select({ count: sql<number>`count(*)` }).from(reconRuns).all();
const excCount = db.select({ count: sql<number>`count(*)` }).from(exceptions).all();

console.log(`\nFinal counts:`);
console.log(`  Runs: ${runCount[0]?.count || 0}`);
console.log(`  Exceptions: ${excCount[0]?.count || 0}`);
console.log('\nDatabase reset complete.');
