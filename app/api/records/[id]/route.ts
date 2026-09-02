/**
 * GET /api/records/[id]
 *
 * Returns normalized source record details and raw JSON payload.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/src/db';
import { getSourceRecordsByIds } from '@/src/db/recon-repository';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    initializeDatabase();
    const { id } = await params;
    const records = getSourceRecordsByIds([id]);
    if (records.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    const r = records[0];
    return NextResponse.json({
      record: {
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
      },
    });
  } catch (err) {
    console.error('[GET /api/records/[id]] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch source record' }, { status: 500 });
  }
}
