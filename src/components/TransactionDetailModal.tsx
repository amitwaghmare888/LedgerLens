"use client";

import { useEffect } from "react";
import { paiseToRupeeDisplay } from "@/src/lib/money";
import { StatusBadge } from "@/src/components/StatusBadge";

export interface TransactionRecord {
  id: string;
  runId: string;
  source: "merchant" | "razorpay" | "bank";
  externalRef: string;
  paymentRef: string;
  orderId: string;
  settlementRef: string;
  utr: string;
  amountPaise: number;
  feePaise: number;
  taxPaise: number;
  netPaise: number;
  occurredAt: string;
  settledAt?: string | null;
  rawJson?: string;
  importId?: string | null;
}

interface TransactionDetailModalProps {
  record: TransactionRecord | null;
  onClose: () => void;
}

export function TransactionDetailModal({ record, onClose }: TransactionDetailModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!record) return null;

  let parsedRaw: Record<string, unknown> | null = null;
  if (record.rawJson) {
    try {
      parsedRaw = JSON.parse(record.rawJson);
    } catch {
      parsedRaw = null;
    }
  }

  const sourceLabels: Record<string, string> = {
    merchant: "Merchant Books (ERP)",
    razorpay: "Razorpay Settlement Report",
    bank: "Bank Statement",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-[var(--surface-container)] border border-[var(--outline-variant)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)] bg-[var(--surface-container-high)]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px] text-[var(--color-on-surface-variant)]">
              receipt_long
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--color-on-surface)]">
                Transaction Detail
              </h2>
              <p className="text-[12px] text-[var(--color-on-surface-variant)] font-mono">
                {record.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={record.source} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] transition-colors"
              title="Close modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top Banner */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                Source System
              </span>
              <p className="text-[14px] font-semibold text-[var(--color-on-surface)]">
                {sourceLabels[record.source] ?? record.source}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                Net Amount
              </span>
              <p className="text-[20px] font-bold text-[var(--color-on-surface)] font-mono">
                ₹{paiseToRupeeDisplay(record.netPaise)}
              </p>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--color-on-surface)] mb-2.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">payments</span>
              Financial Invariant Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                <span className="text-[11px] text-[var(--color-on-surface-variant)] block">Gross (Paise)</span>
                <span className="text-[14px] font-semibold font-mono text-[var(--color-on-surface)]">
                  ₹{paiseToRupeeDisplay(record.amountPaise)}
                </span>
                <span className="text-[10px] text-[var(--color-on-surface-variant)] block font-mono mt-0.5">
                  {record.amountPaise} p
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                <span className="text-[11px] text-[var(--color-on-surface-variant)] block">Fee Deducted</span>
                <span className="text-[14px] font-semibold font-mono text-[var(--color-on-surface)]">
                  ₹{paiseToRupeeDisplay(record.feePaise)}
                </span>
                <span className="text-[10px] text-[var(--color-on-surface-variant)] block font-mono mt-0.5">
                  {record.feePaise} p
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                <span className="text-[11px] text-[var(--color-on-surface-variant)] block">GST / Tax</span>
                <span className="text-[14px] font-semibold font-mono text-[var(--color-on-surface)]">
                  ₹{paiseToRupeeDisplay(record.taxPaise)}
                </span>
                <span className="text-[10px] text-[var(--color-on-surface-variant)] block font-mono mt-0.5">
                  {record.taxPaise} p
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--color-explained)]/30">
                <span className="text-[11px] text-[var(--color-explained)] block font-medium">Net Settlement</span>
                <span className="text-[14px] font-semibold font-mono text-[var(--color-explained)]">
                  ₹{paiseToRupeeDisplay(record.netPaise)}
                </span>
                <span className="text-[10px] text-[var(--color-explained)]/70 block font-mono mt-0.5">
                  {record.netPaise} p
                </span>
              </div>
            </div>
          </div>

          {/* Reference Identifiers */}
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--color-on-surface)] mb-2.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">tag</span>
              Reference Identifiers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
              <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                <span className="text-[var(--color-on-surface-variant)]">External Ref:</span>
                <span className="font-mono font-medium text-[var(--color-on-surface)]">
                  {record.externalRef || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                <span className="text-[var(--color-on-surface-variant)]">Payment Ref:</span>
                <span className="font-mono font-medium text-[var(--color-on-surface)]">
                  {record.paymentRef || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                <span className="text-[var(--color-on-surface-variant)]">Order ID:</span>
                <span className="font-mono font-medium text-[var(--color-on-surface)]">
                  {record.orderId || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                <span className="text-[var(--color-on-surface-variant)]">Settlement Ref:</span>
                <span className="font-mono font-medium text-[var(--color-on-surface)]">
                  {record.settlementRef || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] sm:col-span-2">
                <span className="text-[var(--color-on-surface-variant)]">Bank UTR:</span>
                <span className="font-mono font-medium text-[var(--color-on-surface)]">
                  {record.utr || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Timing & Dates */}
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--color-on-surface)] mb-2.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              Timestamps & Timing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
              <div className="p-2.5 rounded bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                <span className="text-[var(--color-on-surface-variant)] block text-[11px]">Occurred At</span>
                <span className="font-mono text-[var(--color-on-surface)]">
                  {record.occurredAt ? new Date(record.occurredAt).toLocaleString() : "—"}
                </span>
              </div>
              <div className="p-2.5 rounded bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                <span className="text-[var(--color-on-surface-variant)] block text-[11px]">Settled At</span>
                <span className="font-mono text-[var(--color-on-surface)]">
                  {record.settledAt ? new Date(record.settledAt).toLocaleString() : "— (Unsettled / Pending)"}
                </span>
              </div>
            </div>
          </div>

          {/* Raw Payload */}
          {parsedRaw && (
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--color-on-surface)] mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">data_object</span>
                Raw Ingested Record Payload
              </h3>
              <pre className="p-3 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] text-[11px] font-mono text-[var(--color-on-surface-variant)] overflow-x-auto max-h-40">
                {JSON.stringify(parsedRaw, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-[var(--outline-variant)] bg-[var(--surface-container-high)]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--surface-container-highest)] text-[var(--color-on-surface)] hover:bg-[var(--outline)]/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
