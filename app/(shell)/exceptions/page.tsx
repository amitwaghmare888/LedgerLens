"use client";

import { useState, useEffect, useMemo } from "react";
import { paiseToRupeeDisplay, sumPaise } from "@/src/lib/money";
import { StatusBadge } from "@/src/components/StatusBadge";
import { ExceptionInvestigationModal, type ExceptionItem } from "@/src/components/ExceptionInvestigationModal";

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);

  // Filters & Search
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"priority" | "amount_desc" | "amount_asc" | "date_desc">("priority");

  function fetchExceptions() {
    setLoading(true);
    setError(null);
    fetch("/api/exceptions")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch exceptions`);
        return res.json();
      })
      .then((data) => {
        setExceptions(data.exceptions ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err.message || err));
        setLoading(false);
      });
  }

  useEffect(() => {
    let isMounted = true;
    fetch("/api/exceptions")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch exceptions`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setExceptions(data.exceptions ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(String(err.message || err));
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Unique types present in dataset
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    exceptions.forEach((e) => types.add(e.type));
    return Array.from(types).sort();
  }, [exceptions]);

  // Filtered and Sorted Exceptions
  const filteredExceptions = useMemo(() => {
    return exceptions
      .filter((e) => {
        if (severityFilter !== "all") {
          const sev = e.severity.toLowerCase();
          if (severityFilter === "critical" && sev !== "critical" && sev !== "p1 critical") return false;
          if (severityFilter === "high" && sev !== "high" && sev !== "p2 high") return false;
          if (severityFilter === "medium" && sev !== "medium" && sev !== "p3 medium") return false;
          if (severityFilter === "low" && sev !== "low" && sev !== "p4 low") return false;
        }
        if (typeFilter !== "all" && e.type !== typeFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchId = e.id.toLowerCase().includes(q);
          const matchDesc = e.description.toLowerCase().includes(q);
          const matchType = e.type.toLowerCase().includes(q);
          const matchRun = e.runId.toLowerCase().includes(q);
          if (!matchId && !matchDesc && !matchType && !matchRun) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
        }
        if (sortBy === "amount_desc") {
          return b.amountPaise - a.amountPaise;
        }
        if (sortBy === "amount_asc") {
          return a.amountPaise - b.amountPaise;
        }
        if (sortBy === "date_desc") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });
  }, [exceptions, severityFilter, typeFilter, searchQuery, sortBy]);

  // Aggregate stats
  const totalExposurePaise = useMemo(() => {
    return sumPaise(exceptions.map((e) => e.amountPaise));
  }, [exceptions]);

  const criticalCount = useMemo(() => {
    return exceptions.filter(
      (e) => e.severity === "critical" || e.severity === "P1 Critical" || e.severity === "high" || e.severity === "P2 High"
    ).length;
  }, [exceptions]);

  // CSV Export function
  function handleExportCSV() {
    if (filteredExceptions.length === 0) return;

    // CSV header
    const headers = [
      "Exception ID",
      "Type",
      "Severity",
      "Priority Score",
      "Amount (Paise)",
      "Amount (Rupees)",
      "Description",
      "Source Record Count",
      "Source Record IDs",
      "Run ID",
      "Created At",
      "Age (Days)",
    ];

    // CSV rows
    const rows = filteredExceptions.map((exc) => {
      const ageMs = Date.now() - new Date(exc.createdAt).getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      
      return [
        exc.id,
        exc.type,
        exc.severity,
        exc.priorityScore,
        exc.amountPaise,
        paiseToRupeeDisplay(exc.amountPaise),
        `"${exc.description.replace(/"/g, '""')}"`, // Escape quotes
        exc.sourceRecordIds.length,
        `"${exc.sourceRecordIds.join(", ")}"`,
        exc.runId,
        new Date(exc.createdAt).toISOString(),
        ageDays,
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `ledgerlens-exceptions-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col w-full px-6 py-8 gap-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-on-surface)]">
              Exception Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[12px] font-mono font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface-variant)]">
              {exceptions.length} Total
            </span>
          </div>
          <p className="text-[13px] text-[var(--color-on-surface-variant)] mt-1">
            Deterministic anomalies requiring human investigation. Sorted by financial priority.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredExceptions.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline-variant)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={filteredExceptions.length === 0 ? "No exceptions to export" : "Export to CSV"}
          >
            <span className="material-symbols-outlined text-[18px]">
              download
            </span>
            Export CSV
          </button>

          <button
            onClick={fetchExceptions}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline-variant)] transition-colors"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
            Refresh Queue
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Total Unresolved
            </span>
            <span className="material-symbols-outlined text-[20px] text-[var(--color-unresolved)]">
              pending_actions
            </span>
          </div>
          <p className="text-[24px] font-bold text-[var(--color-on-surface)] font-mono mt-1">
            {exceptions.length}
          </p>
          <span className="text-[11px] text-[var(--color-on-surface-variant)]">
            Active exception tickets
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              High & Critical
            </span>
            <span className="material-symbols-outlined text-[20px] text-[var(--color-critical)]">
              emergency
            </span>
          </div>
          <p className="text-[24px] font-bold text-[var(--color-critical)] font-mono mt-1">
            {criticalCount}
          </p>
          <span className="text-[11px] text-[var(--color-on-surface-variant)]">
            Priority attention required
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Total Exposure
            </span>
            <span className="material-symbols-outlined text-[20px] text-[var(--color-review)]">
              monetization_on
            </span>
          </div>
          <p className="text-[24px] font-bold text-[var(--color-on-surface)] font-mono mt-1">
            ₹{paiseToRupeeDisplay(totalExposurePaise)}
          </p>
          <span className="text-[11px] text-[var(--color-on-surface-variant)] font-mono">
            {totalExposurePaise} paise in variance
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Policy Invariants
            </span>
            <span className="material-symbols-outlined text-[20px] text-[var(--color-explained)]">
              verified
            </span>
          </div>
          <p className="text-[24px] font-bold text-[var(--color-explained)] font-mono mt-1">
            0 Tolerance
          </p>
          <span className="text-[11px] text-[var(--color-on-surface-variant)]">
            Zero guesswork policy
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-container-high)] border border-[var(--outline-variant)]">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-on-surface-variant)]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by exception ID, description..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-[13px] bg-[var(--surface-container-lowest)] text-[var(--color-on-surface)] border border-[var(--outline-variant)] focus:outline-none focus:border-[var(--primary)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-[13px] bg-[var(--surface-container-lowest)] text-[var(--color-on-surface)] border border-[var(--outline-variant)] focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">P1 Critical</option>
            <option value="high">P2 High</option>
            <option value="medium">P3 Medium</option>
            <option value="low">P4 Low</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-[13px] bg-[var(--surface-container-lowest)] text-[var(--color-on-surface)] border border-[var(--outline-variant)] focus:outline-none max-w-[200px]"
          >
            <option value="all">All Exception Types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-[12px] text-[var(--color-on-surface-variant)] whitespace-nowrap">
            Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1.5 rounded-lg text-[13px] bg-[var(--surface-container-lowest)] text-[var(--color-on-surface)] border border-[var(--outline-variant)] focus:outline-none"
          >
            <option value="priority">Priority Score (Highest First)</option>
            <option value="amount_desc">Amount (Highest First)</option>
            <option value="amount_asc">Amount (Lowest First)</option>
            <option value="date_desc">Date (Newest First)</option>
          </select>
        </div>
      </div>

      {/* Main Table / Exception List */}
      <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--color-on-surface-variant)]">
            <span className="material-symbols-outlined animate-spin text-[36px]">
              progress_activity
            </span>
            <p className="text-[14px]">Fetching live exceptions from database...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <span className="material-symbols-outlined text-[36px] text-[var(--color-critical)]">
              error
            </span>
            <p className="text-[14px] text-[var(--color-critical)] font-medium">
              Failed to load exceptions: {error}
            </p>
            <button
              onClick={fetchExceptions}
              className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)]"
            >
              Try Again
            </button>
          </div>
        ) : filteredExceptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--color-on-surface-variant)] gap-3 text-center px-4">
            <span className="material-symbols-outlined text-[48px] opacity-40">
              check_circle
            </span>
            <p className="text-[15px] font-medium text-[var(--color-on-surface)]">
              {exceptions.length === 0 ? "No Exceptions Found" : "No Matching Exceptions"}
            </p>
            <p className="text-[13px] max-w-md">
              {exceptions.length === 0
                ? "All ingested transactions are cleanly reconciled or no runs have executed yet. Run reconciliation to view anomalies."
                : "No exceptions match the current filter or search criteria. Try clearing filters."}
            </p>
            {exceptions.length > 0 && (
              <button
                onClick={() => {
                  setSeverityFilter("all");
                  setTypeFilter("all");
                  setSearchQuery("");
                }}
                className="mt-2 text-[13px] font-medium text-[var(--primary)] hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Type / Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Exposure (₹)</th>
                  <th className="py-3 px-4 text-center">Priority</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]">
                {filteredExceptions.map((exc) => (
                  <tr
                    key={exc.id}
                    className="hover:bg-[var(--surface-container-high)]/40 transition-colors cursor-pointer group"
                    onClick={() => setSelectedExceptionId(exc.id)}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={exc.severity} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-[12px] font-medium text-[var(--color-on-surface)] px-2 py-0.5 rounded bg-[var(--surface-container)]">
                        {exc.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-[var(--color-on-surface)] font-medium truncate" title={exc.description}>
                        {exc.description}
                      </p>
                      <span className="text-[11px] text-[var(--color-on-surface-variant)] font-mono">
                        ID: {exc.id} • {exc.sourceRecordIds.length} records
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-[var(--color-critical)]">
                        ₹{paiseToRupeeDisplay(exc.amountPaise)}
                      </span>
                      <span className="block text-[10px] text-[var(--color-on-surface-variant)] font-mono">
                        {exc.amountPaise} p
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-12 h-2 rounded-full bg-[var(--surface-container-highest)] overflow-hidden">
                          <div
                            className="h-full bg-[var(--color-review)]"
                            style={{ width: `${Math.min(100, exc.priorityScore)}%` }}
                          />
                        </div>
                        <span className="font-mono font-semibold text-[11px] text-[var(--color-on-surface)]">
                          {exc.priorityScore}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-[12px] text-[var(--color-on-surface-variant)] font-mono">
                      {new Date(exc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedExceptionId(exc.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded text-[12px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline-variant)] transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">manage_search</span>
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Exception Investigation Modal */}
      {selectedExceptionId && (
        <ExceptionInvestigationModal
          exceptionId={selectedExceptionId}
          onClose={() => setSelectedExceptionId(null)}
        />
      )}
    </div>
  );
}
