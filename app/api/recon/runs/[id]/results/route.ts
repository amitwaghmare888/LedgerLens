import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/src/db';
import { getRunResults } from '@/src/db/recon-repository';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    initializeDatabase();
    const { id } = await params;
    const results = getRunResults(id);
    return NextResponse.json({
      runId: id,
      decisions: results.decisions.map((d) => ({
        id: d.id,
        status: d.status,
        matchType: d.matchType,
        sourceRecordIds: d.sourceRecordIds,
        differencePaise: d.differencePaise,
        evidence: d.evidence,
      })),
      exceptions: results.exceptions.map((e) => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        amountPaise: e.amountPaise,
        priorityScore: e.priorityScore,
        description: e.description,
        sourceRecordIds: e.sourceRecordIds,
      })),
    });
  } catch (err) {
    console.error('[GET /api/recon/runs/[id]/results] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}