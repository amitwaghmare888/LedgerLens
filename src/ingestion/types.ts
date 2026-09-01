/**
 * LedgerLens Ingestion — Shared Types
 *
 * Framework-independent. No DB, no HTTP, no React.
 */

// ============================================================
// Parsed input
// ============================================================

/** A single row from a CSV or XLSX file, keyed by raw header string. */
export type ParsedRow = Record<string, string>;

export type ImportSource = 'merchant' | 'razorpay' | 'bank';
export type ImportFormat = 'csv' | 'xlsx';

// ============================================================
// Column mapping
// ============================================================

export interface MappingResult {
  /** Raw headers detected in the file. */
  detectedHeaders: string[];
  /** raw header → logical field name (for known fields). */
  mappedFields: Record<string, string>;
  /** Logical field names that are required but not found. */
  missingRequired: string[];
  /** Raw headers that did not match any known field. */
  unknownHeaders: string[];
  /** Non-fatal warnings (e.g. unused optional alias). */
  warnings: string[];
}

// ============================================================
// Validation
// ============================================================

export interface RowError {
  /** 1-based row number in the file (header row = 1, first data row = 2). */
  rowNumber: number;
  /** Raw cell values from the source row. */
  rawRow: ParsedRow;
  /** Validation error messages. */
  errors: string[];
}

// ============================================================
// Import result
// ============================================================

/**
 * The result of running the full ingestion pipeline on a file.
 * Returned before or after persistence (preview or confirmed).
 */
export interface ImportResult {
  /** Client-generated or server-assigned import ID. */
  importId: string;
  source: ImportSource;
  filename: string;
  format: ImportFormat;
  /** For XLSX: which sheet was processed. */
  sheetName?: string;
  /** For XLSX: all sheets in the workbook (for sheet selection UI). */
  availableSheets?: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warnings: string[];
  mappingResult: MappingResult;
  rowErrors: RowError[];
}

// ============================================================
// Import batch record (persisted)
// ============================================================

export type ImportStatus = 'preview' | 'confirmed' | 'failed';

export interface ImportBatchRecord {
  id: string;
  source: ImportSource;
  filename: string;
  format: ImportFormat;
  sheetName: string | null;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningsJson: string; // JSON array of warning strings
  createdAt: string;
}
