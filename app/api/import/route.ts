/**
 * POST /api/import
 *
 * Accepts a multipart/form-data file upload and runs the ingestion pipeline.
 *
 * Fields:
 *   file        — CSV or XLSX file (required)
 *   source      — "merchant" | "razorpay" | "bank" (required)
 *   confirmImport — "true" | "false" (required)
 *     false → preview only (no DB write)
 *     true  → persist import batch + source records
 *   sheetName   — XLSX sheet name (optional; defaults to first sheet)
 *   runId       — Reconciliation run ID to associate records with (required for confirmImport=true)
 *
 * Response (ImportApiResponse):
 * {
 *   importId: string
 *   source: string
 *   filename: string
 *   format: "csv" | "xlsx"
 *   sheetName?: string
 *   availableSheets?: string[]
 *   totalRows: number
 *   validRows: number
 *   invalidRows: number
 *   warnings: string[]
 *   confirmed: boolean
 *   rowErrors: Array<{ rowNumber: number; errors: string[] }>
 * }
 *
 * Security:
 * - File size enforced at parse (10 MB)
 * - Extension NOT trusted alone — format determined by field value, not filename
 * - No credentials exposed to client
 * - No macros or active content executed
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initializeDatabase } from '@/src/db';
import {
  persistImportBatch,
  persistSourceRecords,
  createRun,
} from '@/src/db/recon-repository';
import { runImportPipeline } from '@/src/ingestion/import-pipeline';
import type { ImportBatchRecord, ImportFormat, ImportSource } from '@/src/ingestion/types';

export const dynamic = 'force-dynamic';

// Zod validation for form fields
const ImportFieldsSchema = z.object({
  source: z.enum(['merchant', 'razorpay', 'bank']),
  confirmImport: z.enum(['true', 'false']),
  sheetName: z.string().optional(),
  runId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // ── Parse multipart form ──────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  // ── Validate fields ───────────────────────────────────────
  const rawFields = {
    source: formData.get('source'),
    confirmImport: formData.get('confirmImport'),
    sheetName: formData.get('sheetName') ?? undefined,
    runId: formData.get('runId') ?? undefined,
  };

  const parsedFields = ImportFieldsSchema.safeParse(rawFields);
  if (!parsedFields.success) {
    return NextResponse.json(
      { error: 'Invalid request fields', details: parsedFields.error.issues },
      { status: 400 }
    );
  }

  const { source, confirmImport, sheetName, runId: providedRunId } = parsedFields.data;
  const confirm = confirmImport === 'true';

  // ── File ─────────────────────────────────────────────────
  const fileEntry = formData.get('file');
  if (!fileEntry || typeof fileEntry === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const file = fileEntry as File;
  const filename = file.name;

  // Determine format from the explicit format field first, then fall back to extension
  const formatField = formData.get('format') as string | null;
  let format: ImportFormat;
  if (formatField === 'csv' || formatField === 'xlsx') {
    format = formatField;
  } else if (filename.toLowerCase().endsWith('.csv')) {
    format = 'csv';
  } else if (filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xls')) {
    format = 'xlsx';
  } else {
    return NextResponse.json(
      { error: 'Cannot determine file format. Provide format field: "csv" or "xlsx"' },
      { status: 400 }
    );
  }

  // Read file content
  let fileContent: Buffer | string;
  try {
    const arrayBuf = await file.arrayBuffer();
    if (format === 'csv') {
      fileContent = Buffer.from(arrayBuf).toString('utf-8');
    } else {
      fileContent = Buffer.from(arrayBuf);
    }
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 400 });
  }

  // ── Run ingestion pipeline ────────────────────────────────
  const runId = confirm ? (providedRunId ?? createRun(`Import: ${filename}`)) : 'preview';

  let pipelineResult: Awaited<ReturnType<typeof runImportPipeline>>;
  try {
    pipelineResult = runImportPipeline({
      fileContent,
      filename,
      format,
      source: source as ImportSource,
      sheetName: sheetName as string | undefined,
      runId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 422 }
    );
  }

  const { result, validRecords } = pipelineResult;

  // ── Persist (only on confirm) ─────────────────────────────
  if (confirm) {
    try {
      initializeDatabase();

      const batch: ImportBatchRecord = {
        id: result.importId,
        source: result.source,
        filename: result.filename,
        format: result.format,
        sheetName: result.sheetName ?? null,
        status: 'confirmed',
        totalRows: result.totalRows,
        validRows: result.validRows,
        invalidRows: result.invalidRows,
        warningsJson: JSON.stringify(result.warnings),
        createdAt: new Date().toISOString(),
      };

      persistImportBatch(batch);
      persistSourceRecords(runId, validRecords, result.importId);
    } catch (e) {
      return NextResponse.json(
        { error: 'Persistence failed', message: String(e) },
        { status: 500 }
      );
    }
  }

  // ── Response ──────────────────────────────────────────────
  return NextResponse.json({
    importId: result.importId,
    source: result.source,
    filename: result.filename,
    format: result.format,
    sheetName: result.sheetName,
    availableSheets: result.availableSheets,
    totalRows: result.totalRows,
    validRows: result.validRows,
    invalidRows: result.invalidRows,
    warnings: result.warnings,
    confirmed: confirm,
    // Row errors: only return row number + messages (not raw rows — avoids logging financial data)
    rowErrors: result.rowErrors.map((e) => ({
      rowNumber: e.rowNumber,
      errors: e.errors,
    })),
  });
}
