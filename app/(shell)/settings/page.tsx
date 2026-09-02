"use client";

import { StatusBadge } from "@/src/components/StatusBadge";

export default function SettingsPage() {
  return (
    <div className="flex flex-col w-full px-6 py-8 gap-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-on-surface)]">
            System & Engine Settings
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[var(--surface-container-high)] text-[var(--color-explained)]">
            Active
          </span>
        </div>
        <p className="text-[13px] text-[var(--color-on-surface-variant)] mt-1">
          Configuration, financial invariants, database driver, and reconciliation rules.
        </p>
      </div>

      {/* Section 1: Financial Invariants & Recon Parameters */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--outline-variant)] pb-2">
          <span className="material-symbols-outlined text-[20px] text-[var(--color-explained)]">
            verified
          </span>
          <h2 className="text-[16px] font-semibold text-[var(--color-on-surface)]">
            Reconciliation Engine Rules & Invariants
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--color-on-surface)]">
                Monetary Representation
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)] text-[var(--color-explained)]">
                Strict Integer Paise
              </span>
            </div>
            <p className="text-[12px] text-[var(--color-on-surface-variant)]">
              All financial math is performed in integer paise (1 INR = 100 paise). Floating point arithmetic is strictly forbidden in the codebase.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--color-on-surface)]">
                Tolerance Threshold
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)] text-[var(--color-explained)]">
                0 Paise (Zero Tolerance)
              </span>
            </div>
            <p className="text-[12px] text-[var(--color-on-surface-variant)]">
              Deterministic matching requires exact balance. Discrepancies (fees, taxes, refunds) must be proven with arithmetic rules rather than tolerance ranges.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--color-on-surface)]">
                Settlement Window Policy
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--surface-container-high)] text-[var(--color-on-surface)]">
                T+2 Business Days
              </span>
            </div>
            <p className="text-[12px] text-[var(--color-on-surface-variant)]">
              Standard Razorpay settlement timeline. Settlements delayed beyond T+2 are classified into the timing delay exception queue.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--color-on-surface)]">
                Matching Hierarchy Order
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--surface-container-high)] text-[var(--color-on-surface)]">
                3-Tier Pipeline
              </span>
            </div>
            <p className="text-[12px] text-[var(--color-on-surface-variant)]">
              1. Exact 3-way correlation &rarr; 2. Deterministic Rule Matching (Fee/GST/Refund/Adjustment) &rarr; 3. N-to-1 Batch Aggregation.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Persistence & DB Infrastructure */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--outline-variant)] pb-2">
          <span className="material-symbols-outlined text-[20px] text-[var(--color-on-surface-variant)]">
            database
          </span>
          <h2 className="text-[16px] font-semibold text-[var(--color-on-surface)]">
            Persistence & Database Configuration
          </h2>
        </div>

        <div className="p-5 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] space-y-4 text-[13px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--outline-variant)]">
            <div>
              <span className="font-semibold text-[var(--color-on-surface)]">Active Database Driver</span>
              <p className="text-[12px] text-[var(--color-on-surface-variant)]">
                Configured via <code className="font-mono text-[11px] bg-[var(--surface-container-high)] px-1.5 py-0.5 rounded">LEDGERLENS_DB_DRIVER</code> environment variable.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-[12px] font-mono font-bold bg-[var(--surface-container-high)] text-[var(--color-on-surface)]">
                SQLite (better-sqlite3)
              </span>
              <StatusBadge status="validated" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--outline-variant)]">
            <div>
              <span className="font-semibold text-[var(--color-on-surface)]">Firebase Data Connect Schema</span>
              <p className="text-[12px] text-[var(--color-on-surface-variant)]">
                Production-ready PostgreSQL / Cloud SQL schema definitions and GraphQL connector.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[12px] font-mono font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface-variant)]">
              dataconnect/schema.gql Ready
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-[var(--color-on-surface)]">Audit Trail Immutability</span>
              <p className="text-[12px] text-[var(--color-on-surface-variant)]">
                Every reconciliation session and exception transition is logged to <code className="font-mono text-[11px] bg-[var(--surface-container-high)] px-1.5 py-0.5 rounded">audit_log</code>.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[12px] font-medium bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)] text-[var(--color-explained)]">
              Enabled
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Data Ingestion & Formats */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--outline-variant)] pb-2">
          <span className="material-symbols-outlined text-[20px] text-[var(--color-on-surface-variant)]">
            upload_file
          </span>
          <h2 className="text-[16px] font-semibold text-[var(--color-on-surface)]">
            Data Ingestion & Column Mapping
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Merchant Books (ERP)
            </span>
            <p className="text-[13px] font-semibold text-[var(--color-on-surface)] mt-1">
              CSV / Excel (.xlsx)
            </p>
            <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-1">
              Auto-maps Txn ID, Order ID, Gross Amount, Date, Customer Reference.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Razorpay Settlement
            </span>
            <p className="text-[13px] font-semibold text-[var(--color-on-surface)] mt-1">
              CSV / Excel (.xlsx)
            </p>
            <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-1">
              Auto-maps Payment ID, Settlement ID, Fee, GST, Net Amount, UTR.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Bank Statements
            </span>
            <p className="text-[13px] font-semibold text-[var(--color-on-surface)] mt-1">
              CSV / Excel (.xlsx)
            </p>
            <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-1">
              Auto-maps Bank Ref, Credit/Debit Type, Amount, Value Date, Narration.
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: Phase 5 AI Boundary Status */}
      <div className="p-4 rounded-xl bg-[var(--surface-container-high)] border border-[var(--outline-variant)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-[var(--color-review)]">
            smart_toy
          </span>
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--color-on-surface)]">
              AI Autonomous Controller (Phase 5)
            </h3>
            <p className="text-[12px] text-[var(--color-on-surface-variant)]">
              Constrained LLM hypothesis generation with deterministic verification will activate in Phase 5.
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[var(--surface-container-highest)] text-[var(--color-on-surface-variant)] whitespace-nowrap">
          Phase 4 Active
        </span>
      </div>
    </div>
  );
}
