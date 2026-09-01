/**
 * LedgerLens Ingestion — CSV Parser
 *
 * Server-side only. Uses papaparse (no DOM required for Node).
 * Returns ParsedRow[] — a common tabular representation.
 *
 * Limits enforced here (before mapping/validation):
 * - Max file size: 10 MB (enforced upstream in the route)
 * - Max rows: 50,000
 */
import Papa from 'papaparse';
import type { ParsedRow } from './types';

export const CSV_MAX_ROWS = 50_000;

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

/**
 * Parses CSV text into ParsedRow[].
 * - Strips BOM
 * - Trims whitespace from headers and values
 * - Throws CsvParseError on empty file, missing headers, or row limit exceeded
 */
export function parseCsv(text: string, filename: string): ParsedRow[] {
  if (!text || text.trim().length === 0) {
    throw new CsvParseError(`${filename}: file is empty`);
  }

  const result = Papa.parse<ParsedRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
    transform: (v: string) => v.trim(),
  });

  if (result.errors.length > 0) {
    // Surface the first fatal error; non-fatal ones (e.g. extra columns) are OK.
    const fatal = result.errors.find((e) => (e.type as string) === 'Delimiter' || (e.type as string) === 'Abort');
    if (fatal) {
      throw new CsvParseError(`${filename}: ${fatal.message}`);
    }
  }

  if (!result.meta.fields || result.meta.fields.length === 0) {
    throw new CsvParseError(`${filename}: no headers detected`);
  }

  if (result.data.length > CSV_MAX_ROWS) {
    throw new CsvParseError(
      `${filename}: too many rows (${result.data.length} > ${CSV_MAX_ROWS} limit)`
    );
  }

  return result.data;
}

/**
 * Returns the detected headers from the first row of a CSV string.
 * Used for preview before full parse.
 */
export function detectCsvHeaders(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  return Papa.parse<string[]>(firstLine, { header: false }).data[0]?.map((h) => h.trim()) ?? [];
}
