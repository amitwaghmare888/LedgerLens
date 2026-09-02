import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/src/db';
import { getExceptionWithAudit, getLatestInvestigation } from '@/src/db/recon-repository';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    initializeDatabase();
    const { id } = await params;
    const result = getExceptionWithAudit(id);
    if (!result) return NextResponse.json({ error: 'Exception not found' }, { status: 404 });

    // Load latest AI investigation if available
    const investigation = getLatestInvestigation(id);

    return NextResponse.json({
      exception: {
        id: result.exception.id,
        runId: result.exception.runId,
        type: result.exception.type,
        severity: result.exception.severity,
        amountPaise: result.exception.amountPaise,
        priorityScore: result.exception.priorityScore,
        description: result.exception.description,
        sourceRecordIds: result.exception.sourceRecordIds,
        createdAt: result.exception.createdAt,
      },
      sourceRecords: result.sourceRecords.map((r) => ({
        id: r.id,
        runId: r.runId,
        source: r.source,
        externalRef: r.externalRef,
        paymentRef: r.paymentRef,
        orderId: r.orderId,
        settlementRef: r.settlementRef,
        utr: r.utr,
        amountPaise: r.amountPaise,
        feePaise: r.feePaise,
        taxPaise: r.taxPaise,
        netPaise: r.netPaise,
        occurredAt: r.occurredAt instanceof Date ? r.occurredAt.toISOString() : r.occurredAt,
        settledAt: r.settledAt instanceof Date ? r.settledAt.toISOString() : r.settledAt,
        rawJson: r.rawJson,
      })),
      auditEvents: result.auditEvents.map((e) => ({
        eventType: e.eventType,
        reason: e.reason,
        evidence: e.evidence,
        occurredAt: e.occurredAt,
      })),
      investigation: investigation
        ? {
            provider: investigation.provider,
            model: investigation.model,
            verificationStatus: investigation.verificationStatus,
            verificationDetails: investigation.verificationDetails,
            aiOutput: investigation.aiOutput,
            timestamp: investigation.timestamp,
            tokensUsed: investigation.tokensUsed,
          }
        : null,
    });
  } catch (err) {
    console.error('[GET /api/exceptions/[id]] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch exception' }, { status: 500 });
  }
}