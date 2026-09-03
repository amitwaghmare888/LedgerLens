/**
 * GET /api/search?q=query
 *
 * Searches source records and exceptions by observable fields.
 * Returns matching records and exceptions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDb } from '@/src/db';
import { sourceRecords, exceptions } from '@/src/db/schema';
import { or, like, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    initializeDatabase();
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Limit search to prevent excessive results
    const maxResults = 10;

    // Search source records by observable fields
    const recordResults = await db
      .select({
        type: sql<string>`'record'`,
        id: sourceRecords.id,
        source: sourceRecords.source,
        externalRef: sourceRecords.externalRef,
        paymentRef: sourceRecords.paymentRef,
        orderId: sourceRecords.orderId,
        utr: sourceRecords.utr,
        amountPaise: sourceRecords.amountPaise,
        occurredAt: sourceRecords.occurredAt,
      })
      .from(sourceRecords)
      .where(
        or(
          like(sourceRecords.id, `%${query}%`),
          like(sourceRecords.externalRef, `%${query}%`),
          like(sourceRecords.paymentRef, `%${query}%`),
          like(sourceRecords.orderId, `%${query}%`),
          like(sourceRecords.utr, `%${query}%`),
          like(sourceRecords.settlementRef, `%${query}%`)
        )
      )
      .limit(maxResults);

    // Search exceptions
    const exceptionResults = await db
      .select({
        type: sql<string>`'exception'`,
        id: exceptions.id,
        exceptionType: exceptions.type,
        description: exceptions.description,
        amountPaise: exceptions.amountPaise,
        severity: exceptions.severity,
        createdAt: exceptions.createdAt,
      })
      .from(exceptions)
      .where(
        or(
          like(exceptions.id, `%${query}%`),
          like(exceptions.description, `%${query}%`)
        )
      )
      .limit(maxResults);

    // Combine results
    const results = [
      ...recordResults.map((r) => ({
        type: 'record' as const,
        id: r.id,
        source: r.source,
        label: `${r.source} • ${r.externalRef || r.paymentRef || r.orderId || r.utr}`,
        secondary: `Amount: ₹${(r.amountPaise / 100).toFixed(2)}`,
        matchedField: [r.externalRef, r.paymentRef, r.orderId, r.utr]
          .filter((f) => f && f.toLowerCase().includes(query.toLowerCase()))
          .join(', '),
      })),
      ...exceptionResults.map((e) => ({
        type: 'exception' as const,
        id: e.id,
        label: `${e.exceptionType} • ${e.id}`,
        secondary: e.description,
        severity: e.severity,
      })),
    ];

    return NextResponse.json({ results: results.slice(0, maxResults) });
  } catch (err) {
    console.error('[GET /api/search] Error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
