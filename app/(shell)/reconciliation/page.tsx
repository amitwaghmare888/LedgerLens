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

export default function ReconciliationPage() {
  // Source state
  const [sources, setSources] = useState<ReconciliationSource[]>(
    MOCK_RECONCILIATION_SOURCES,
  );

  // UI state
  const [stage] = useState<PipelineStage>("idle");

  const allSourcesReady = sources.every((s) => s.status !== "not_added" && s.status !== "error");


  function handleRemove(id: string) {
    setSources((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "not_added", filename: undefined, recordCount: undefined } : s,
      ),
    );
  }

  function handleReplace(id: string) {
    // Phase 2: file picker
    void id;
  }

  function handleUpload(id: string) {
    // Phase 2: file picker
    void id;
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

        <button
          disabled
          aria-disabled="true"
          title="Reconciliation engine not yet connected — available in Phase 2"
          className="flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-medium transition-all shadow-sm bg-[var(--surface-variant)] text-[var(--color-on-surface-variant)] cursor-not-allowed opacity-60 whitespace-nowrap"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            construction
          </span>
          <span className="whitespace-nowrap">Engine Not Connected</span>
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

      {/* Mock data notice */}
      <p className="text-[11px] text-[var(--color-on-surface-variant)] opacity-50 text-center pb-2">
        ⚠ Source data and analysis figures are mock values — file upload not yet connected
      </p>
    </div>
  );
}
