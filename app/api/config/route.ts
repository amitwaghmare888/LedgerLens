/**
 * GET /api/config
 *
 * Returns non-sensitive server configuration for the client UI.
 * Exposes only status information — never API keys.
 */
import { NextResponse } from 'next/server';
import { loadProviderConfig } from '@/src/ai/provider-factory';

export const dynamic = 'force-dynamic';

export async function GET() {
  const providerConfig = loadProviderConfig();

  return NextResponse.json({
    ai: {
      configured: providerConfig !== null,
      provider: providerConfig?.provider ?? null,
      model: providerConfig?.model ?? null,
    },
    db: {
      driver: process.env.LEDGERLENS_DB_DRIVER ?? 'sqlite',
    },
  });
}
