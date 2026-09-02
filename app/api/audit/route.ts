/**
 * GET /api/audit
 *
 * Returns persisted audit log events across reconciliation runs.
 */
import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/src/db';
import { getAllAuditEvents } from '@/src/db/recon-repository';

export async function GET() {
  try {
    initializeDatabase();
    const events = getAllAuditEvents(250);
    return NextResponse.json({
      auditEvents: events.map((e) => ({
        id: e.id,
        runId: e.runId,
        entityType: e.entityType,
        entityId: e.entityId,
        action: e.action,
        details: e.details,
        performedBy: e.performedBy,
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    console.error('[GET /api/audit] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
