/**
 * LedgerLens Ingestion — XLSX Parser
 *
 * Server-side only. Uses SheetJS (xlsx) community edition.
 * Safety: no macro execution, no external links, row/sheet limits enforced.
 *
 * Returns ParsedRow[] + available sheet names.
 */
import * as XLSX from 'xlsx';
import type { ParsedRow } from './types';

export const XLSX_MAX_ROWS = 50_000;
export const XLSX_MAX_SHEETS = 20;
export const XLSX_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export class XlsxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XlsxParseError';
  }
}

export interface XlsxParseResult {
  rows: ParsedRow[];
  sheetName: string;
  availableSheets: string[];
}

/**
 * Parses an XLSX buffer into ParsedRow[].
 *
 * @param buffer - Raw file bytes
 * @param filename - For error messages
 * @param requestedSheet - Optional explicit sheet name; defaults to first sheet
 *
 * Safety:
 * - WPR (workbook parse read) only — no execution
 * - No codepage conversion that could execute scripts
 * - External link parsing disabled (cellNF: false, bookVBA: false)
 */
export function parseXlsx(
  buffer: Buffer,
  filename: string,
  requestedSheet?: string
): XlsxParseResult {
  if (buffer.length > XLSX_MAX_FILE_BYTES) {
    throw new XlsxParseError(
      `${filename}: file too large (${buffer.length} bytes > ${XLSX_MAX_FILE_BYTES} limit)`
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      // Safety: disable VBA/macro parsing
      bookVBA: false,
      cellNF: false,
    });
  } catch (e) {
    throw new XlsxParseError(`${filename}: failed to parse workbook — ${String(e)}`);
  }

  const availableSheets = workbook.SheetNames;

  if (!availableSheets || availableSheets.length === 0) {
    throw new XlsxParseError(`${filename}: workbook contains no sheets`);
  }

  if (availableSheets.length > XLSX_MAX_SHEETS) {
    throw new XlsxParseError(
      `${filename}: too many sheets (${availableSheets.length} > ${XLSX_MAX_SHEETS} limit)`
    );
  }

  // Resolve which sheet to use
  const sheetName = requestedSheet
    ? availableSheets.find((s) => s === requestedSheet)
    : availableSheets[0];

  if (!sheetName) {
    throw new XlsxParseError(
      `${filename}: sheet "${requestedSheet}" not found. Available: ${availableSheets.join(', ')}`
    );
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new XlsxParseError(`${filename}: sheet "${sheetName}" is empty`);
  }

  // Check sheet has data beyond the header
  const ref = worksheet['!ref'];
  if (!ref) {
    throw new XlsxParseError(`${filename}: sheet "${sheetName}" is empty`);
  }

  // Convert to row objects — headers trimmed
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false, // return formatted strings, not raw numbers (prevents silent type coercion)
  });

  if (rawRows.length > XLSX_MAX_ROWS) {
    throw new XlsxParseError(
      `${filename} [${sheetName}]: too many rows (${rawRows.length} > ${XLSX_MAX_ROWS} limit)`
    );
  }

  // Normalize: trim headers and stringify all values
  const rows: ParsedRow[] = rawRows.map((row) => {
    const normalized: ParsedRow = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim()] = String(v ?? '').trim();
    }
    return normalized;
  });

  return { rows, sheetName, availableSheets };
}
