"use client";

import { useState, useEffect, useMemo } from "react";
import { ExceptionInvestigationModal } from "@/src/components/ExceptionInvestigationModal";

interface AuditLogItem {
  id: string;
  runId: string;
  entityType: string;
  entityId: string;
  action: string;
  details: string;
  performedBy: string;
  createdAt: string;
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [investigatingId, setInvestigatingId] = useState<string | null>(null);

  function fetchAuditLog() {
    setLoading(true);
    setError(null);
    fetch("/api/audit")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch audit log`);
        return res.json();
      })
      .then((data) => {
        setEvents(data.auditEvents ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err.message || err));
        setLoading(false);
      });
  }

  useEffect(() => {
    let isMounted = true;
    fetch("/api/audit")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch audit log`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setEvents(data.auditEvents ?? []);
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

  const availableEntities = useMemo(() => {
    const s = new Set<string>();
    events.forEach((e) => s.add(e.entityType));
    return Array.from(s).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (entityFilter !== "all" && e.entityType !== entityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAction = e.action.toLowerCase().includes(q);
        const matchEntity = e.entityId.toLowerCase().includes(q);
        const matchDetails = e.details.toLowerCase().includes(q);
        const matchRun = e.runId.toLowerCase().includes(q);
        if (!matchAction && !matchEntity && !matchDetails && !matchRun) return false;
      }
      return true;
    });
  }, [events, entityFilter, searchQuery]);

  return (
    <div className="flex flex-col w-full px-6 py-8 gap-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-on-surface)]">
              Audit Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[12px] font-mono font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface-variant)]">
              {events.length} Events Logged
            </span>
          </div>
          <p className="text-[13px] text-[var(--color-on-surface-variant)] mt-1">
            Immutable log of all reconciliation runs, deterministic decisions, and exception events.
          </p>
        </div>

        <button
          onClick={fetchAuditLog}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline-variant)] transition-colors self-start sm:self-auto"
        >
          <span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>
            refresh
          </span>
          Refresh Audit Log
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Total Logged Events
            </span>
            <span className="material-symbols-outlined text-[20px] text-[var(--color-on-surface-variant)]">
              receipt_long
            </span>
          </div>
          <p className="text-[24px] font-bold text-[var(--color-on-surface)] font-mono mt-1">
            {events.length}
          </p>
          <span className="text-[11px] text-[var(--color-on-surface-variant)]">
            Persisted in SQLite audit_log
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Exceptions Raised
            </span>
            <span className="material-symbols-outlined text-[20px] text-[var(--color-critical)]">
              report
            </span>
          </div>
          <p className="text-[24px] font-bold text-[var(--color-critical)] font-mono mt-1">
            {events.filter((e) => e.entityType === "exception").length}
          </p>
          <span className="text-[11px] text-[var(--color-on-surface-variant)]">
            Invariant breach events
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Provenance Security
            </span>
            <span className="material-symbols-outlined text-[20px] text-[var(--color-explained)]">
              verified_user
            </span>
          </div>
          <p className="text-[24px] font-bold text-[var(--color-explained)] font-mono mt-1">
            Deterministic
          </p>
          <span className="text-[11px] text-[var(--color-on-surface-variant)]">
            Zero tampering policy
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-container-high)] border border-[var(--outline-variant)]">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-on-surface-variant)]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit action, entity ID, details..."
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

          {/* Entity Filter */}
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-[13px] bg-[var(--surface-container-lowest)] text-[var(--color-on-surface)] border border-[var(--outline-variant)] focus:outline-none"
          >
            <option value="all">All Entity Types</option>
            {availableEntities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--color-on-surface-variant)]">
            <span className="material-symbols-outlined animate-spin text-[36px]">
              progress_activity
            </span>
            <p className="text-[14px]">Loading audit trail records...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <span className="material-symbols-outlined text-[36px] text-[var(--color-critical)]">
              error
            </span>
            <p className="text-[14px] text-[var(--color-critical)] font-medium">
              Failed to load audit trail: {error}
            </p>
            <button
              onClick={fetchAuditLog}
              className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)]"
            >
              Retry
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--color-on-surface-variant)] gap-3 text-center px-4">
            <span className="material-symbols-outlined text-[48px] opacity-40">
              history_toggle_off
            </span>
            <p className="text-[15px] font-medium text-[var(--color-on-surface)]">
              No Audit Events Found
            </p>
            <p className="text-[13px] max-w-md">
              {events.length === 0
                ? "No reconciliation sessions or exception events have been recorded in the database yet."
                : "No audit events match your search or filter criteria."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Action / Event</th>
                  <th className="py-3 px-4">Details / Evidence</th>
                  <th className="py-3 px-4">Performer</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)] font-mono text-[12px]">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[var(--surface-container-high)]/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-[var(--color-on-surface-variant)] font-mono">
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)]">
                        {evt.entityType}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[var(--color-on-surface)]">
                      {evt.entityId}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-[var(--color-on-surface)]">
                      {evt.action}
                    </td>
                    <td className="py-3 px-4 font-sans text-[var(--color-on-surface-variant)] max-w-md truncate" title={evt.details}>
                      {evt.details || "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[var(--surface-container-highest)] text-[var(--color-on-surface-variant)]">
                        {evt.performedBy}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {evt.entityType === "exception" ? (
                        <button
                          onClick={() => setInvestigatingId(evt.entityId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-sans font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline-variant)] transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          View
                        </button>
                      ) : (
                        <span className="text-[var(--color-on-surface-variant)] text-[11px] font-sans">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Exception Detail Investigation Modal if an exception entity is clicked */}
      {investigatingId && (
        <ExceptionInvestigationModal
          exceptionId={investigatingId}
          onClose={() => setInvestigatingId(null)}
        />
      )}
    </div>
  );
}
