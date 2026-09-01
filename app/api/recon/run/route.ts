/**
 * POST /api/recon/run
 *
 * Starts a reconciliation run against the seeded source records.
 * Loads records, runs the engine, persists results.
 *
 * Request body (Zod-validated): { runName?: string }
 *
 * Response (stable domain-level — no internal implementation details):
 * {
 *   runId: string;
 *   status: "completed" | "failed";
 *   totalRecords: number;
 *   matchedCount: number;
 *   explainedCount: number;
 *   exceptionCount: number;
 *   durationMs: number;
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initializeDatabase } from '@/src/db';
import {
  createRun,
  loadSourceRecords,
  persistDecisions,
  persistExceptions,
  writeAuditEvents,
  updateRunStatus,
} from '@/src/db/recon-repository';
import { runReconciliationEngine } from '@/src/reconciliation/engine';

const SEED_RUN_ID = 'run_seed_dev';

const RequestSchema = z.object({
  runName: z.string().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const startMs = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const runName = parsed.data.runName ?? `Reconciliation Run ${new Date().toISOString()}`;

  try {
    // Ensure DB is initialized (idempotent)
    initializeDatabase();

    // Load source records from the seeded run
    const sourceRecords = loadSourceRecords(SEED_RUN_ID);
    if (sourceRecords.length === 0) {
      return NextResponse.json(
        { error: 'No source records found. Run `npm run seed` first.' },
        { status: 422 }
      );
    }

    // Create a new run
    const runId = createRun(runName);

    try {
      // Run the engine (pure domain logic — no DB inside)
      const result = runReconciliationEngine(runId, sourceRecords);

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

      return NextResponse.json({
        runId,
        status: 'completed',
        totalRecords: sourceRecords.length,
        matchedCount,
        explainedCount,
        exceptionCount,
        durationMs: Date.now() - startMs,
      });
    } catch (engineError) {
      updateRunStatus(runId, 'failed', {
        totalRecords: sourceRecords.length,
        matchedCount: 0,
        explainedCount: 0,
        exceptionCount: 0,
      });
      throw engineError;
    }
  } catch (err) {
    console.error('[POST /api/recon/run] Error:', err);
    return NextResponse.json(
      { error: 'Reconciliation run failed', message: String(err) },
      { status: 500 }
    );
  }
}
