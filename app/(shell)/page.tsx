import type { Metadata } from "next";
import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  MOCK_OVERVIEW_METRICS,
  MOCK_RECENT_RUNS,
  MOCK_TOP_EXCEPTIONS,
  formatPaise,
  formatDuration,
} from "@/data/mock";

export const metadata: Metadata = {
  title: "Overview — LedgerLens",
  description: "Ledger reconciliation health and exception monitoring.",
};

export default function OverviewPage() {
  const m = MOCK_OVERVIEW_METRICS;

  return (
    <div className="flex flex-col w-full px-6 pb-6 gap-6">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex flex-col">
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-on-surface)]">
            System Overview
          </h1>
          <p className="text-[14px] text-[var(--color-on-surface-variant)] mt-1">
            Ledger reconciliation health and exception monitoring.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/exceptions"
            className="h-10 px-4 rounded-lg bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-highest)] transition-colors flex items-center justify-center gap-2 text-[var(--color-on-surface)] text-[13px] font-semibold"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              visibility
            </span>
            View Exceptions
          </Link>
          <Link
            href="/reconciliation"
            className="h-10 px-4 rounded-lg bg-[var(--color-primary)] hover:opacity-80 transition-opacity flex items-center justify-center gap-2 text-[var(--color-on-primary)] text-[13px] font-semibold"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              play_arrow
            </span>
            Run Reconciliation
          </Link>
        </div>
      </div>

      {/* ── KPI Metric cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="Total Records"
          value={m.totalRecords.toLocaleString("en-IN")}
          trend="Mock dataset"
          trendIcon="dataset"
          trendColor="muted"
          accentVar="--color-primary"
        />
        <MetricCard
          label="Matched"
          value={`${m.matchedPercent}%`}
          sub={m.matchedCount.toLocaleString("en-IN")}
          trend={m.matchedTrend}
          trendIcon="check_circle"
          trendColor="green"
          accentVar="--color-explained"
        />
        <MetricCard
          label="Needs Review"
          value={m.needsReview.toLocaleString("en-IN")}
          trend={m.needsReviewTrend}
          trendIcon="trending_up"
          trendColor="amber"
          indicator
          accentVar="--color-review"
        />
        <MetricCard
          label="Explained"
          value={m.explained.toLocaleString("en-IN")}
          trend="Auto-resolved"
          trendIcon="sync_saved_locally"
          trendColor="muted"
          accentVar="--color-secondary"
        />
        <MetricCard
          label="Total Financial Exposure"
          value={formatPaise(m.totalExposurePaise)}
          sub=""
          trend={`Across ${m.exposureItemCount} high-priority items`}
          trendColor="muted"
          accentVar="--color-critical"
        />
      </div>

      {/* ── Lower grid: runs + exceptions ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-cols: health banner + recent runs */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Reconciliation health banner */}
          <div className="bg-[var(--surface-container-lowest)] rounded-xl shadow-sm border border-[var(--outline-variant)] p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)] flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[var(--color-explained)]"
                  style={{ fontSize: "24px" }}
                >
                  task_alt
                </span>
              </div>
              <div>
                <h3 className="text-[18px] leading-[24px] font-semibold text-[var(--color-on-surface)]">
                  Reconciliation Health:{" "}
                  {m.healthStatus === "optimal" ? "Optimal" : m.healthStatus === "degraded" ? "Degraded" : "Failed"}
                </h3>
                <p className="text-[13px] text-[var(--color-on-surface-variant)] mt-1">
                  Last run completed successfully {m.lastRunMinutesAgo} minutes ago.
                </p>
              </div>
            </div>
            <div className="flex gap-8 text-right hidden sm:flex">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-on-surface-variant)]">
                  Duration
                </p>
                <p className="font-mono text-[13px] font-medium text-[var(--color-on-surface)] mt-1 tabular-nums">
                  {formatDuration(m.lastRunDurationSeconds)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-on-surface-variant)]">
                  Processed
                </p>
                <p className="font-mono text-[13px] font-medium text-[var(--color-on-surface)] mt-1 tabular-nums">
                  {m.lastRunProcessed.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {/* Recent runs table */}
          <div className="bg-[var(--surface-container-lowest)] rounded-xl shadow-sm border border-[var(--outline-variant)] overflow-hidden flex flex-col flex-1">
            <div className="px-6 py-4 border-b border-[var(--outline-variant)] flex items-center justify-between">
              <h2 className="text-[18px] leading-[24px] font-semibold text-[var(--color-on-surface)]">
                Recent Runs
              </h2>
              <button className="text-[13px] text-[var(--color-primary)] hover:underline">
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" role="table">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)] text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-on-surface-variant)]">
                    <th className="px-6 py-3 font-semibold">Date &amp; Time</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Coverage</th>
                    <th className="px-6 py-3 font-semibold text-right">Issues</th>
                    <th className="px-6 py-3 font-semibold text-right">Exposure</th>
                    <th className="px-6 py-3 font-semibold text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] tabular-nums">
                  {MOCK_RECENT_RUNS.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b last:border-0 border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)] transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-3 font-mono text-[13px] font-medium">
                        {run.label}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-6 py-3 text-right text-[var(--color-on-surface)]">
                        {run.coveragePercent != null
                          ? `${run.coveragePercent}%`
                          : <span className="text-[var(--color-on-surface-variant)]">--</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {run.issueCount != null ? (
                          <span className="text-[var(--color-review)] font-medium">
                            {run.issueCount}
                          </span>
                        ) : (
                          <span className="text-[var(--color-on-surface-variant)]">--</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right text-[var(--color-on-surface)]">
                        {run.exposurePaise != null
                          ? formatPaise(run.exposurePaise)
                          : <span className="text-[var(--color-on-surface-variant)]">--</span>}
                      </td>
                      <td className="px-6 py-3 text-right text-[var(--color-on-surface-variant)] font-mono text-[13px]">
                        {formatDuration(run.durationSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right col: top exceptions */}
        <div className="bg-[var(--surface-container-lowest)] rounded-xl shadow-sm border border-[var(--outline-variant)] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--outline-variant)] flex items-center justify-between">
            <h2 className="text-[18px] leading-[24px] font-semibold text-[var(--color-on-surface)]">
              Top Exceptions
            </h2>
            <span
              className="material-symbols-outlined text-[var(--color-on-surface-variant)]"
              style={{ fontSize: "20px" }}
            >
              filter_list
            </span>
          </div>
          <div className="flex flex-col p-2 gap-1 overflow-y-auto">
            {MOCK_TOP_EXCEPTIONS.map((exc) => (
              <Link
                key={exc.id}
                href="/exceptions"
                className="p-4 rounded-lg hover:bg-[var(--surface-container-low)] transition-colors flex flex-col gap-2 border border-transparent hover:border-[var(--outline-variant)]"
              >
                <div className="flex items-center justify-between">
                  <StatusBadge status={exc.severity} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-on-surface-variant)]">
                    SLA:{" "}
                    <span
                      className={
                        exc.slaUrgent
                          ? "text-[var(--color-critical)] font-bold"
                          : "text-[var(--color-review)] font-bold"
                      }
                    >
                      {exc.slaLabel}
                    </span>
                  </span>
                </div>
                <div className="flex items-end justify-between mt-1">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--color-on-surface)] truncate">
                      {exc.description}
                    </p>
                    <p className="font-mono text-[12px] text-[var(--color-on-surface-variant)] mt-0.5 truncate max-w-[180px]">
                      {exc.ref}
                    </p>
                  </div>
                  <span className="text-[14px] font-semibold text-[var(--color-on-surface)] tabular-nums">
                    {formatPaise(exc.amountPaise)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mock data notice */}
      <p className="text-[11px] text-[var(--color-on-surface-variant)] opacity-50 text-center pb-2">
        ⚠ Displaying mock data — connect reconciliation engine in Phase 2
      </p>
    </div>
  );
}
