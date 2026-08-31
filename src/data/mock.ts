/**
 * Mock data layer for LedgerLens UI development.
 *
 * IMPORTANT: This is MOCK data only. It is isolated here so it can be
 * replaced with real DB/API calls in Phase 2 without touching UI components.
 *
 * Do NOT use these values as production business metrics.
 */

export type RunStatus = "completed" | "failed" | "running" | "pending";
export type ExceptionSeverity = "P1 Critical" | "P2 High" | "P3 Medium";
export type SourceStatus = "validated" | "ready" | "not_added" | "error";

export interface OverviewMetrics {
  totalRecords: number;
  matchedPercent: number;
  matchedCount: number;
  matchedTrend: string;
  needsReview: number;
  needsReviewTrend: string;
  explained: number;
  totalExposurePaise: number;
  exposureItemCount: number;
  lastRunMinutesAgo: number;
  lastRunDurationSeconds: number;
  lastRunProcessed: number;
  healthStatus: "optimal" | "degraded" | "failed";
}

export interface RecentRun {
  id: string;
  label: string;
  status: RunStatus;
  coveragePercent: number | null;
  issueCount: number | null;
  exposurePaise: number | null;
  durationSeconds: number;
}

export interface TopException {
  id: string;
  severity: ExceptionSeverity;
  slaLabel: string;
  slaUrgent: boolean;
  description: string;
  ref: string;
  amountPaise: number;
}

export interface ReconciliationSource {
  id: "merchant" | "razorpay" | "bank";
  label: string;
  sublabel?: string;
  icon: string;
  status: SourceStatus;
  filename?: string;
  recordCount?: number;
}

export interface PreRunAnalysis {
  totalVolumePaise: number;
  expectedMatchRate: number;
  estimatedDurationSeconds: number;
}

// ─── Overview ────────────────────────────────────────────────────────────────

export const MOCK_OVERVIEW_METRICS: OverviewMetrics = {
  totalRecords: 142508,
  matchedPercent: 98.2,
  matchedCount: 138210,
  matchedTrend: "Last completed run",
  needsReview: 4298,
  needsReviewTrend: "Pending investigation",
  explained: 3120,
  totalExposurePaise: 4824150_00, // ₹48,24,150
  exposureItemCount: 182,
  lastRunMinutesAgo: 12,
  lastRunDurationSeconds: 252,
  lastRunProcessed: 142508,
  healthStatus: "optimal",
};

export const MOCK_RECENT_RUNS: RecentRun[] = [
  {
    id: "run-001",
    label: "Today, 09:00 AM",
    status: "completed",
    coveragePercent: 98.2,
    issueCount: 182,
    exposurePaise: 4824000_00,
    durationSeconds: 252,
  },
  {
    id: "run-002",
    label: "Yesterday, 18:00 PM",
    status: "completed",
    coveragePercent: 97.8,
    issueCount: 214,
    exposurePaise: 5210000_00,
    durationSeconds: 301,
  },
  {
    id: "run-003",
    label: "Yesterday, 09:00 AM",
    status: "failed",
    coveragePercent: null,
    issueCount: null,
    exposurePaise: null,
    durationSeconds: 45,
  },
];

export const MOCK_TOP_EXCEPTIONS: TopException[] = [
  {
    id: "exc-001",
    severity: "P1 Critical",
    slaLabel: "2 hrs",
    slaUrgent: true,
    description: "Missing Core Deposit",
    ref: "TRX-8921-A",
    amountPaise: 1250000_00,
  },
  {
    id: "exc-002",
    severity: "P1 Critical",
    slaLabel: "14 hrs",
    slaUrgent: false,
    description: "Payment Gateway Mismatch",
    ref: "PG-992-B",
    amountPaise: 840250_00,
  },
  {
    id: "exc-003",
    severity: "P2 High",
    slaLabel: "36 hrs",
    slaUrgent: false,
    description: "Duplicate Settlement",
    ref: "STL-441-X",
    amountPaise: 327500_00,
  },
];

// ─── Reconciliation ───────────────────────────────────────────────────────────

export const MOCK_RECONCILIATION_SOURCES: ReconciliationSource[] = [
  {
    id: "merchant",
    label: "Merchant Books",
    icon: "book",
    status: "validated",
    filename: "INT_LEDGER_Q3_SEP24.csv",
    recordCount: 142508,
  },
  {
    id: "razorpay",
    label: "Processor Data",
    sublabel: "Razorpay",
    icon: "account_balance_wallet",
    status: "ready",
    filename: "RZP_SETTL_SEP24_FINAL.csv",
    recordCount: 145102,
  },
  {
    id: "bank",
    label: "Bank Statement",
    icon: "upload_file",
    status: "not_added",
  },
];

export const MOCK_PRE_RUN_ANALYSIS: PreRunAnalysis = {
  totalVolumePaise: 14250000000_00, // ₹142.5M
  expectedMatchRate: 98.2,
  estimatedDurationSeconds: 252,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format integer paise into display rupee string (e.g. 482415000 → "₹48,24,150") */
export function formatPaise(paise: number): string {
  const rupees = Math.floor(paise / 100);
  return "₹" + rupees.toLocaleString("en-IN");
}

/** Format duration in seconds to Xm Ys */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}
