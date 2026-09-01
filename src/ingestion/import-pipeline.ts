/**
 * LedgerLens Ingestion — Import Pipeline
 *
 * Orchestrates: parse → map → validate → ImportResult
 *
 * Pure function — no DB, no HTTP, no React.
 * CSV and XLSX converge to the same ParsedRow[] and then the same pipeline.
 */
import { randomUUID } from 'crypto';
import { parseCsv, CsvParseError } from './parse-csv';
import { parseXlsx, XlsxParseError } from './parse-xlsx';
import { mapColumns, applyMapping } from './column-map';
import { validateRows } from './validate';
import type { ImportFormat, ImportResult, ImportSource } from './types';

export const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface RunImportOptions {
  /** Raw file content as Buffer (for XLSX) or string (for CSV). */
  fileContent: Buffer | string;
  filename: string;
  format: ImportFormat;
  source: ImportSource;
  /** For XLSX: explicitly select a sheet. Defaults to first sheet. */
  sheetName?: string;
  /** The run ID to assign to validated NormalizedRecords. */
  runId: string;
  /** Pre-generated import ID (or one will be created). */
  importId?: string;
}

/**
 * Runs the full ingestion pipeline for one file upload.
 *
 * Returns ImportResult. Does NOT write to DB — the caller decides
 * whether to persist (preview vs. confirm).
 *
 * Throws only for unrecoverable parse failures (bad file format, file too large).
 * Row-level errors are captured in ImportResult.rowErrors.
 */
export function runImportPipeline(opts: RunImportOptions): {
  result: ImportResult;
  /** Validated, normalized records — ready for reconciliation engine. */
  validRecords: import('../domain/types').NormalizedRecord[];
} {
  const {
    fileContent,
    filename,
    format,
    source,
    sheetName: requestedSheet,
    runId,
    importId = randomUUID(),
  } = opts;

  // Check file size
  const byteLength =
    typeof fileContent === 'string'
      ? Buffer.byteLength(fileContent, 'utf-8')
      : fileContent.length;

  if (byteLength > IMPORT_MAX_FILE_BYTES) {
    throw new Error(
      `${filename}: file too large (${byteLength} bytes > ${IMPORT_MAX_FILE_BYTES} limit)`
    );
  }

  // ── Parse ──────────────────────────────────────────────────
  let parsedRows: import('./types').ParsedRow[];
  let resolvedSheet: string | undefined;
  let availableSheets: string[] | undefined;

  if (format === 'csv') {
    try {
      const text = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf-8');
      parsedRows = parseCsv(text, filename);
    } catch (e) {
      if (e instanceof CsvParseError) throw e;
      throw new Error(`${filename}: CSV parse failed — ${String(e)}`);
    }
  } else {
    try {
      const buf = Buffer.isBuffer(fileContent)
        ? fileContent
        : Buffer.from(fileContent as string, 'utf-8');
      const xlsxResult = parseXlsx(buf, filename, requestedSheet);
      parsedRows = xlsxResult.rows;
      resolvedSheet = xlsxResult.sheetName;
      availableSheets = xlsxResult.availableSheets;
    } catch (e) {
      if (e instanceof XlsxParseError) throw e;
      throw new Error(`${filename}: XLSX parse failed — ${String(e)}`);
    }
  }

  // ── Column mapping ─────────────────────────────────────────
  const headers = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];
  const mappingResult = mapColumns(headers, source);

  // Hard stop if required fields are missing
  if (mappingResult.missingRequired.length > 0) {
    throw new Error(
      `${filename}: missing required columns for source "${source}": ${mappingResult.missingRequired.join(', ')}`
    );
  }

  // Apply mapping: raw headers → logical field names
  const mappedRows = parsedRows.map((row) => applyMapping(row, mappingResult.mappedFields));

  // ── Validate ───────────────────────────────────────────────
  // firstDataRowNumber = 2 (row 1 = header)
  const { valid: validRecords, invalid: rowErrors } = validateRows(
    mappedRows,
    source,
    runId,
    2
  );

  const result: ImportResult = {
    importId,
    source,
    filename,
    format,
    sheetName: resolvedSheet,
    availableSheets,
    totalRows: parsedRows.length,
    validRows: validRecords.length,
    invalidRows: rowErrors.length,
    warnings: mappingResult.warnings,
    mappingResult,
    rowErrors,
  };

  return { result, validRecords };
}
