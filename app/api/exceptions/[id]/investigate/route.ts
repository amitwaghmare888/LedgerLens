/**
 * POST /api/exceptions/[id]/investigate
 *
 * Triggers AI investigation for an unresolved exception.
 * Server-side only. No API keys exposed to client.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/src/db';
import {
  getExceptionById,
  getSourceRecordsByIds,
  loadSourceRecords,
  persistInvestigation,
} from '@/src/db/recon-repository';
import { investigateException } from '@/src/ai/investigation-orchestrator';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initializeDatabase();
    const { id } = await params;

    // Load exception
    const exception = getExceptionById(id);
    if (!exception) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 });
    }

    // Load linked source records
    const linkedRecords = getSourceRecordsByIds(exception.sourceRecordIds);
    if (linkedRecords.length === 0) {
      return NextResponse.json(
        { error: 'No source records found for exception' },
        { status: 400 }
      );
    }

    // Load all records from the same run (for candidate selection)
    const allRecords = loadSourceRecords(exception.runId);

    // Load audit events (for deterministic findings)
    // For now, use empty array - full audit integration can be added later
    const auditEvents: Array<{ reason: string; evidence: string }> = [];

    // Run investigation
    const investigation = await investigateException({
      exception,
      linkedRecords,
      allRecords,
      auditEvents,
    });

    // Persist investigation result
    await persistInvestigation(investigation.result);

    // Return result to client
    return NextResponse.json({
      success: true,
      result: {
        exceptionId: investigation.result.exceptionId,
        provider: investigation.result.provider,
        model: investigation.result.model,
        verificationStatus: investigation.result.verificationStatus,
        verificationDetails: investigation.result.verificationDetails,
        aiOutput: {
          conclusion: investigation.result.aiOutput.conclusion,
          summary: investigation.result.aiOutput.summary,
          candidateRecordIds: investigation.result.aiOutput.candidateRecordIds,
          evidence: investigation.result.aiOutput.evidence,
          discrepancies: investigation.result.aiOutput.discrepancies,
          recommendedAction: investigation.result.aiOutput.recommendedAction,
        },
        timestamp: investigation.result.timestamp,
        tokensUsed: investigation.result.tokensUsed,
      },
      metadata: {
        candidateSelectionReason: investigation.evidence.candidateSelectionReason,
        totalCandidatesConsidered: investigation.evidence.totalCandidatesConsidered,
      },
    });
  } catch (err) {
    console.error('[POST /api/exceptions/[id]/investigate] Error:', err);
    return NextResponse.json(
      {
        error: 'Investigation failed',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
