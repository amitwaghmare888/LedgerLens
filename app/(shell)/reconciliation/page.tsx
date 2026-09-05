"use client";

import { useState } from "react";
import { SourceCard } from "@/components/SourceCard";

import {
  MOCK_RECONCILIATION_SOURCES,
  MOCK_PRE_RUN_ANALYSIS,
  formatPaise,
  formatDuration,
  type ReconciliationSource,
} from "@/data/mock";

type PipelineStage = "idle" | "imported" | "normalized" | "matching" | "exceptions" | "verified" | "completed";

const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "imported", label: "Imported" },
  { key: "normalized", label: "Normalized" },
  { key: "matching", label: "Matching" },
  { key: "exceptions", label: "Exceptions" },
  { key: "verified", label: "Verified" },
  { key: "completed", label: "Completed" },
];

const STAGE_INDEX: Record<PipelineStage, number> = {
  idle: -1,
  imported: 0,
  normalized: 1,
  matching: 2,
  exceptions: 3,
  verified: 4,
  completed: 5,
};

// ── Import state per source ───────────────────────────────────────────────────
type ImportStatus = "idle" | "previewing" | "preview_ready" | "confirming" | "confirmed" | "error";
interface SourceImportState {
  status: ImportStatus;
  preview: { importId: string; filename: string; format: string; sheetName?: string; availableSheets?: string[]; totalRows: number; validRows: number; invalidRows: number; warnings: string[]; rowErrors: { rowNumber: number; errors: string[] }[]; } | null;
  error: string | null;
  selectedSheet: string | null;
}
const INIT_IMPORT: SourceImportState = { status: "idle", preview: null, error: null, selectedSheet: null };

export default function ReconciliationPage() {
  const [sources, setSources] = useState<ReconciliationSource[]>(MOCK_RECONCILIATION_SOURCES);
  const [stage] = useState<PipelineStage>("idle");
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ runId: string; totalRecords: number; matchedCount: number; explainedCount: number; exceptionCount: number; durationMs: number; } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [importState, setImportState] = useState<Record<string, SourceImportState>>({});
  const [fileMap, setFileMap] = useState<Record<string, File>>({});

  const allSourcesReady = sources.every((s) => s.status !== "not_added" && s.status !== "error");
  function getImp(id: string): SourceImportState { return importState[id] ?? INIT_IMPORT; }
  function setImp(id: string, u: Partial<SourceImportState>) { setImportState((p) => ({ ...p, [id]: { ...(p[id] ?? INIT_IMPORT), ...u } })); }

  async function handleStartRun() {
    setIsRunning(true); setRunResult(null); setRunError(null);
    try {
      const res = await fetch("/api/recon/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: "Unknown error" })); setRunError(err.error ?? "Run failed"); return; }
      setRunResult(await res.json());
    } catch (e) { setRunError(String(e)); } finally { setIsRunning(false); }
  }

  function handleRemove(id: string) {
    setSources((p) => p.map((s) => s.id === id ? { ...s, status: "not_added", filename: undefined, recordCount: undefined } : s));
    setImp(id, INIT_IMPORT);
    setFileMap((p) => { const n = { ...p }; delete n[id]; return n; });
  }
  function handleReplace(id: string) { triggerInput(id); }
  function handleUpload(id: string) { triggerInput(id); }
  function triggerInput(id: string) { const el = document.getElementById("file-input-" + id) as HTMLInputElement | null; if (el) { el.value = ""; el.click(); } }

  async function doPreview(sid: string, file: File, sheet?: string) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const format = ext === "csv" ? "csv" : "xlsx";
    setImp(sid, { status: "previewing", error: null });
    const fd = new FormData();
    fd.append("file", file); fd.append("source", sid); fd.append("format", format); fd.append("confirmImport", "false");
    if (sheet) fd.append("sheetName", sheet);
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImp(sid, { status: "error", error: data.error ?? "Preview failed", preview: null }); return; }
      setImp(sid, { status: "preview_ready", preview: data, error: null, selectedSheet: sheet ?? null });
    } catch (e) { setImp(sid, { status: "error", error: String(e), preview: null }); }
  }

  function handleFileSelected(sid: string, file: File) { setFileMap((p) => ({ ...p, [sid]: file })); void doPreview(sid, file); }
  function handleSheetSelect(sid: string, sheet: string) { setImp(sid, { selectedSheet: sheet }); const f = fileMap[sid]; if (f) void doPreview(sid, f, sheet); }

  async function handleConfirmImport(sid: string) {
    const imp = getImp(sid); const f = fileMap[sid];
    if (!imp.preview || !f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    const format = ext === "csv" ? "csv" : "xlsx";
    setImp(sid, { status: "confirming" });
    const fd = new FormData();
    fd.append("file", f); fd.append("source", sid); fd.append("format", format); fd.append("confirmImport", "true");
    if (imp.selectedSheet) fd.append("sheetName", imp.selectedSheet);
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImp(sid, { status: "error", error: data.error ?? "Confirm failed" }); return; }
      setImp(sid, { status: "confirmed" });
      setSources((p) => p.map((s) => s.id === sid ? { ...s, status: "ready", filename: imp.preview!.filename, recordCount: data.validRows } : s));
    } catch (e) { setImp(sid, { status: "error", error: String(e) }); }
  }

  const a = MOCK_PRE_RUN_ANALYSIS;
  const activeStageIndex = STAGE_INDEX[stage];
  return (
    <div className="flex flex-col w-full px-12 py-10 gap-10">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-on-surface)]">
            Reconciliation
          </h1>
          <p className="text-[16px] leading-[24px] text-[var(--color-on-surface-variant)] max-w-2xl">
            Compare merchant records, payment settlements, and bank activity to
            identify discrepancies.
          </p>
        </div>

        {/* Phase 2: Start Reconciliation button */}
        <button
          onClick={handleStartRun}
          disabled={isRunning}
          aria-busy={isRunning}
          className={[
            "flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-medium transition-all shadow-sm whitespace-nowrap",
            isRunning
              ? "bg-[var(--surface-variant)] text-[var(--color-on-surface-variant)] cursor-wait opacity-70"
              : "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 cursor-pointer",
          ].join(" ")}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            {isRunning ? "hourglass_top" : "play_circle"}
          </span>
          <span>{isRunning ? "Running…" : "Start Reconciliation"}</span>
        </button>
      </div>

      {/* ── 01 Source Management ─────────────────────────────────────────── */}
      <section aria-labelledby="section-sources">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-[var(--primary-container)] text-[var(--color-on-primary-container)] flex items-center justify-center text-[11px] font-bold">
            01
          </div>
          <h2
            id="section-sources"
            className="text-[20px] leading-[28px] font-semibold text-[var(--color-on-surface)]"
          >
            Source Management
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onRemove={handleRemove}
              onReplace={handleReplace}
              onUpload={handleUpload}
            />
          ))}
        </div>
        {/* Hidden file inputs */}
        {sources.map((source) => (
          <input
            key={"fi-" + source.id}
            id={"file-input-" + source.id}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(source.id, f); }}
          />
        ))}

        {/* Import preview panels */}
        {sources.map((source) => {
          const imp = getImp(source.id);
          if (imp.status === "idle") return null;
          return (
            <div key={"pv-" + source.id} className="bg-[var(--surface-container)] rounded-xl p-6 flex flex-col gap-4 shadow-sm border border-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[var(--color-on-surface)] capitalize">{source.id} &mdash; Import</span>
                {imp.status === "previewing" && <span className="text-[12px] text-[var(--color-on-surface-variant)] animate-pulse">Analysing&hellip;</span>}
                {imp.status === "confirming" && <span className="text-[12px] text-[var(--color-on-surface-variant)] animate-pulse">Importing&hellip;</span>}
                {imp.status === "confirmed" && <span className="text-[12px] text-[var(--color-explained)] font-medium">&#x2713; Imported</span>}
                {imp.status === "error" && <span className="text-[12px] text-red-500">{imp.error}</span>}
              </div>
              {imp.preview && (
                <>
                  <div className="flex flex-wrap gap-4 text-[12px]">
                    <span className="text-[var(--color-on-surface-variant)]">File: <b className="text-[var(--color-on-surface)]">{imp.preview.filename}</b></span>
                    <span className="text-[var(--color-on-surface-variant)]">Format: <b>{imp.preview.format.toUpperCase()}</b></span>
                    <span className="text-[var(--color-on-surface-variant)]">Rows: <b>{imp.preview.totalRows}</b></span>
                    <span className="text-[var(--color-explained)]">&#x2713; Valid: <b>{imp.preview.validRows}</b></span>
                    {imp.preview.invalidRows > 0 && <span className="text-red-500">&#x2717; Invalid: <b>{imp.preview.invalidRows}</b></span>}
                  </div>
                  {imp.preview.availableSheets && imp.preview.availableSheets.length > 1 && (
                    <div className="flex items-center gap-3">
                      <label className="text-[12px] text-[var(--color-on-surface-variant)]">Sheet:</label>
                      <select className="text-[12px] bg-[var(--surface-container-highest)] text-[var(--color-on-surface)] rounded px-2 py-1 border border-[var(--surface-variant)]" value={imp.selectedSheet ?? imp.preview.sheetName ?? ""} onChange={(e) => handleSheetSelect(source.id, e.target.value)}>
                        {imp.preview.availableSheets.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  {imp.preview.warnings.length > 0 && (
                    <div className="text-[11px] text-amber-600 bg-amber-50 rounded px-3 py-2">
                      {imp.preview.warnings.map((w, i) => <div key={i}>&#x26A0; {w}</div>)}
                    </div>
                  )}
                  {imp.preview.rowErrors.length > 0 && (
                    <div className="text-[11px] text-red-600 bg-red-50 rounded px-3 py-2 max-h-24 overflow-y-auto">
                      {imp.preview.rowErrors.slice(0, 5).map((e) => <div key={e.rowNumber}>Row {e.rowNumber}: {e.errors.join("; ")}</div>)}
                      {imp.preview.rowErrors.length > 5 && <div>&hellip;and {imp.preview.rowErrors.length - 5} more</div>}
                    </div>
                  )}
                  {imp.status === "preview_ready" && (
                    <div className="flex gap-3 pt-1">
                      <button onClick={() => handleConfirmImport(source.id)} disabled={imp.preview.validRows === 0} className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 disabled:opacity-40 transition-all">Confirm Import ({imp.preview.validRows} rows)</button>
                      <button onClick={() => handleRemove(source.id)} className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--surface-variant)] text-[var(--color-on-surface-variant)] hover:opacity-80 transition-all">Cancel</button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </section>

      {/* ── 02 Pre-Run Analysis ──────────────────────────────────────────── */}
      <section aria-labelledby="section-analysis">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-[var(--primary-container)] text-[var(--color-on-primary-container)] flex items-center justify-center text-[11px] font-bold">
            02
          </div>
          <h2
            id="section-analysis"
            className="text-[20px] leading-[28px] font-semibold text-[var(--color-on-surface)]"
          >
            Pre-Run Analysis
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row bg-[var(--surface-container)] shadow-sm rounded-xl p-8 gap-12 items-center">
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-on-surface-variant)]">
              Total Volume
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-on-surface)]">
                {formatPaise(a.totalVolumePaise)}
              </span>
            </div>
          </div>

          <div className="w-px h-16 bg-[var(--surface-variant)] hidden sm:block" />

          <div className="flex flex-col gap-2 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-on-surface-variant)]">
              Expected Match Rate
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-explained)]">
                {a.expectedMatchRate}%
              </span>
              <span
                className="material-symbols-outlined text-[var(--color-explained)]"
                style={{ fontSize: "16px" }}
              >
                trending_up
              </span>
            </div>
          </div>

          <div className="w-px h-16 bg-[var(--surface-variant)] hidden sm:block" />

          <div className="flex flex-col gap-2 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-on-surface-variant)]">
              Est. Processing Time
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-on-surface)]">
                {formatDuration(a.estimatedDurationSeconds)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 Execution Pipeline ────────────────────────────────────────── */}
      <section aria-labelledby="section-pipeline">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-[var(--primary-container)] text-[var(--color-on-primary-container)] flex items-center justify-center text-[11px] font-bold">
            03
          </div>
          <h2
            id="section-pipeline"
            className="text-[20px] leading-[28px] font-semibold text-[var(--color-on-surface)]"
          >
            Execution Pipeline
          </h2>
        </div>

        <div className="bg-[var(--surface-container-low)] shadow-sm rounded-xl p-8">
          <div className="flex flex-col gap-8">
            {/* Pipeline track */}
            <div className="flex items-center justify-between relative">
              {/* Track background */}
              <div className="absolute top-3 left-0 w-full h-1 bg-[var(--surface-container-highest)] rounded-full z-0" />
              {/* Progress fill */}
              {stage !== "idle" && (
                <div
                  className="absolute top-3 left-0 h-1 bg-[var(--color-primary)] rounded-full z-0 transition-all duration-1000"
                  style={{
                    width: `${(activeStageIndex / (PIPELINE_STAGES.length - 1)) * 100}%`,
                  }}
                />
              )}
              {/* Nodes */}
              {PIPELINE_STAGES.map((s, i) => {
                const done = activeStageIndex > i;
                const active = activeStageIndex === i;
                const pending = activeStageIndex < i;
                return (
                  <div
                    key={s.key}
                    className="flex flex-col items-center gap-2 z-10 w-24"
                  >
                    {done && (
                      <div className="w-6 h-6 rounded-full bg-[var(--color-explained)] flex items-center justify-center shadow-sm border-2 border-[var(--surface-container-low)]">
                        <span
                          className="material-symbols-outlined text-white font-bold"
                          style={{ fontSize: "14px" }}
                        >
                          check
                        </span>
                      </div>
                    )}
                    {active && (
                      <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center shadow-md border-4 border-[var(--surface-container-low)] ring-2 ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)] animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-on-primary)]" />
                      </div>
                    )}
                    {pending && (
                      <div className="w-6 h-6 rounded-full bg-[var(--surface-container-highest)] flex items-center justify-center shadow-sm border-2 border-[var(--surface-container-low)]" />
                    )}
                    <span
                      className={[
                        "text-[11px] font-bold uppercase tracking-[0.05em] text-center",
                        active
                          ? "text-[var(--color-primary)] scale-110 transition-transform"
                          : pending
                            ? "text-[var(--color-on-surface-variant)] opacity-40"
                            : "text-[var(--color-on-surface-variant)] opacity-70",
                      ].join(" ")}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Idle state message */}
            {stage === "idle" && (
              <div className="bg-[var(--surface-container)] rounded-lg p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--color-on-surface-variant)_10%,transparent)] flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-[var(--color-on-surface-variant)]"
                    style={{ fontSize: "20px" }}
                  >
                    hourglass_empty
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-medium text-[var(--color-on-surface)]">
                    Ready to Run
                  </span>
                  <span className="text-[13px] text-[var(--color-on-surface-variant)]">
                    {allSourcesReady
                      ? "All sources loaded. Click \"Start Reconciliation Engine\" to begin."
                      : "Add all three data sources to enable reconciliation."}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Phase 2: Run result banner */}
      {runResult && (
        <div className="bg-[var(--surface-container)] rounded-xl px-8 py-6 shadow-lg border border-[color-mix(in_srgb,var(--color-explained)_30%,transparent)]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--outline-variant)]">
            <span className="material-symbols-outlined text-[var(--color-explained)]" style={{ fontSize: "32px" }}>
              check_circle
            </span>
            <div className="flex flex-col">
              <span className="text-[16px] font-semibold text-[var(--color-on-surface)]">
                Reconciliation Complete
              </span>
              <span className="text-[12px] text-[var(--color-on-surface-variant)] font-mono">
                Run ID: {runResult.runId} • Duration: {Math.round(runResult.durationMs)}ms
              </span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {/* Total Records Processed */}
            <div className="flex flex-col items-center p-3 rounded-lg bg-[var(--surface-container-high)]">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)] mb-1">
                Processed
              </span>
              <span className="text-[24px] font-bold text-[var(--color-on-surface)] font-mono">
                {runResult.totalRecords}
              </span>
              <span className="text-[10px] text-[var(--color-on-surface-variant)]">
                records
              </span>
            </div>

            {/* Matched */}
            <div className="flex flex-col items-center p-3 rounded-lg bg-[var(--surface-container-high)]">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)] mb-1">
                Matched
              </span>
              <span className="text-[24px] font-bold text-[var(--color-explained)] font-mono">
                {runResult.matchedCount}
              </span>
              <span className="text-[10px] text-[var(--color-on-surface-variant)]">
                {runResult.totalRecords > 0 ? `${Math.round((runResult.matchedCount / runResult.totalRecords) * 100)}%` : '—'}
              </span>
            </div>

            {/* Explained */}
            <div className="flex flex-col items-center p-3 rounded-lg bg-[var(--surface-container-high)]">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)] mb-1">
                Explained
              </span>
              <span className="text-[24px] font-bold text-[var(--color-on-surface)] font-mono">
                {runResult.explainedCount}
              </span>
              <span className="text-[10px] text-[var(--color-on-surface-variant)]">
                {runResult.totalRecords > 0 ? `${Math.round((runResult.explainedCount / runResult.totalRecords) * 100)}%` : '—'}
              </span>
            </div>

            {/* Unresolved (calculated) */}
            <div className="flex flex-col items-center p-3 rounded-lg bg-[var(--surface-container-high)]">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)] mb-1">
                Unresolved
              </span>
              <span className="text-[24px] font-bold text-[var(--color-unresolved)] font-mono">
                {runResult.totalRecords - runResult.matchedCount - runResult.explainedCount}
              </span>
              <span className="text-[10px] text-[var(--color-on-surface-variant)]">
                {runResult.totalRecords > 0 ? `${Math.round(((runResult.totalRecords - runResult.matchedCount - runResult.explainedCount) / runResult.totalRecords) * 100)}%` : '—'}
              </span>
            </div>

            {/* Exceptions */}
            <div className="flex flex-col items-center p-3 rounded-lg bg-[var(--surface-container-high)]">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)] mb-1">
                Exceptions
              </span>
              <span 
                className="text-[24px] font-bold font-mono"
                style={{ color: runResult.exceptionCount > 0 ? 'var(--color-critical)' : 'var(--color-explained)' }}
              >
                {runResult.exceptionCount}
              </span>
              <span className="text-[10px] text-[var(--color-on-surface-variant)]">
                requiring review
              </span>
            </div>
          </div>

          {/* Primary Action */}
          {runResult.exceptionCount > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--outline-variant)] flex justify-center">
              <a
                href="/exceptions"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  manage_search
                </span>
                Review {runResult.exceptionCount} Exception{runResult.exceptionCount !== 1 ? 's' : ''}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Phase 2: Run error banner */}
      {runError && (
        <div className="bg-[var(--surface-container)] rounded-xl px-8 py-5 flex items-center gap-4 shadow-sm">
          <span className="material-symbols-outlined text-red-500" style={{ fontSize: "24px" }}>error</span>
          <span className="text-[14px] text-[var(--color-on-surface)]">{runError}</span>
        </div>
      )}

      {/* Mock data notice */}
      <p className="text-[11px] text-[var(--color-on-surface-variant)] opacity-50 text-center pb-2">
        ⚠ Source cards show mock data — file upload available in Phase 3. Engine runs against seeded synthetic dataset.
      </p>
    </div>
  );
}
