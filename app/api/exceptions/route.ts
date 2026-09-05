/**
 * GET /api/exceptions
 *
 * Returns exceptions from the latest run only, sorted by priority score descending.
 * Returns stable domain-level objects.
 */
import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/src/db';
import { getLatestRunExceptions } from '@/src/db/recon-repository';

export async function GET() {
  try {
    initializeDatabase();
    const excList = getLatestRunExceptions();
    return NextResponse.json({
      exceptions: excList.map((e) => ({
        id: e.id,
        runId: e.runId,
        type: e.type,
        severity: e.severity,
        amountPaise: e.amountPaise,
        priorityScore: e.priorityScore,
        description: e.description,
        sourceRecordIds: e.sourceRecordIds,
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    console.error('[GET /api/exceptions] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch exceptions' }, { status: 500 });
  }
}
