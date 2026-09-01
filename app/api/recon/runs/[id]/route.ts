import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/src/db';
import { getRunById } from '@/src/db/recon-repository';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    initializeDatabase();
    const { id } = await params;
    const run = getRunById(id);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json(run);
  } catch (err) {
    console.error('[GET /api/recon/runs/[id]] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 });
  }
}