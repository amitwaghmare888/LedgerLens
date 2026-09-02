"use client";

import { useEffect, useState } from "react";
import { paiseToRupeeDisplay } from "@/src/lib/money";
import { StatusBadge } from "@/src/components/StatusBadge";
import { TransactionDetailModal, type TransactionRecord } from "@/src/components/TransactionDetailModal";

export interface ExceptionItem {
  id: string;
  runId: string;
  type: string;
  severity: string;
  amountPaise: number;
  priorityScore: number;
  description: string;
  sourceRecordIds: string[];
  createdAt: string;
}

interface AuditEventDetail {
  eventType: string;
  reason: string;
  evidence: string;
  occurredAt: string;
}

interface AIInvestigation {
  provider: string;
  model: string;
  verificationStatus: 'AI_SUPPORTED' | 'AI_REJECTED' | 'INCONCLUSIVE' | 'AI_UNAVAILABLE';
  verificationDetails: string;
  aiOutput: {
    conclusion: 'supported' | 'unsupported' | 'inconclusive';
    summary: string;
    candidateRecordIds: string[];
    evidence: string[];
    discrepancies: Array<{ field: string; observation: string }>;
    recommendedAction: string;
  };
  timestamp: string;
  tokensUsed?: number;
}

interface ExceptionInvestigationModalProps {
  exceptionId: string | null;
  onClose: () => void;
}

export function ExceptionInvestigationModal({ exceptionId, onClose }: ExceptionInvestigationModalProps) {
  const [exception, setException] = useState<ExceptionItem | null>(null);
  const [sourceRecords, setSourceRecords] = useState<TransactionRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventDetail[]>([]);
  const [investigation, setInvestigation] = useState<AIInvestigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<TransactionRecord | null>(null);
  const [investigating, setInvestigating] = useState(false);
  const [investigationError, setInvestigationError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !selectedRecord) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, selectedRecord]);

  useEffect(() => {
    if (!exceptionId) return;
    let isMounted = true;

    fetch(`/api/exceptions/${encodeURIComponent(exceptionId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load exception (HTTP ${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setException(data.exception);
        setSourceRecords(data.sourceRecords ?? []);
        setAuditEvents(data.auditEvents ?? []);
        setInvestigation(data.investigation ?? null);
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
  }, [exceptionId]);

  async function handleInvestigate() {
    if (!exceptionId || investigating) return;
    setInvestigating(true);
    setInvestigationError(null);

    try {
      const res = await fetch(`/api/exceptions/${encodeURIComponent(exceptionId)}/investigate`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Investigation failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      setInvestigation(data.result);
    } catch (err) {
      setInvestigationError(String(err instanceof Error ? err.message : err));
    } finally {
      setInvestigating(false);
    }
  }

  if (!exceptionId) return null;

  const merchantRecord = sourceRecords.find((r) => r.source === "merchant");
  const razorpayRecord = sourceRecords.find((r) => r.source === "razorpay");
  const bankRecord = sourceRecords.find((r) => r.source === "bank");

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-fade-in">
        <div
          className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl bg-[var(--surface-container)] border border-[var(--outline-variant)] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)] bg-[var(--surface-container-high)]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px] text-[var(--color-critical)]">
                manage_search
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[17px] font-semibold text-[var(--color-on-surface)]">
                    Exception Investigation
                  </h2>
                  {exception && (
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--surface-container-highest)] text-[var(--color-on-surface-variant)]">
                      {exception.id}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--color-on-surface-variant)]">
                  Deterministic Financial Invariant Analysis & Source Correlation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {exception && (
                <>
                  <StatusBadge status={exception.severity} />
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[color-mix(in_srgb,var(--color-unresolved)_15%,transparent)] text-[var(--color-unresolved)] border border-[color-mix(in_srgb,var(--color-unresolved)_25%,transparent)]">
                    UNRESOLVED
                  </span>
                </>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] transition-colors ml-2"
                title="Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--color-on-surface-variant)]">
                <span className="material-symbols-outlined animate-spin text-[36px]">
                  progress_activity
                </span>
                <p className="text-[13px]">Loading exception investigation details...</p>
              </div>
            ) : error || !exception ? (
              <div className="p-4 rounded-lg bg-[color-mix(in_srgb,var(--color-critical)_10%,transparent)] border border-[var(--color-critical)]/30 text-[var(--color-critical)]">
                <p className="font-medium text-[14px]">Error Loading Exception</p>
                <p className="text-[12px] mt-1">{error ?? "Exception record not found."}</p>
              </div>
            ) : (
              <>
                {/* Exception Overview Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                      Classification Type
                    </span>
                    <p className="text-[14px] font-bold text-[var(--color-on-surface)] mt-0.5 font-mono">
                      {exception.type}
                    </p>
                    <span className="text-[11px] text-[var(--color-on-surface-variant)] mt-1 block">
                      Run: <span className="font-mono">{exception.runId}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                      Monetary Exposure
                    </span>
                    <p className="text-[18px] font-bold text-[var(--color-critical)] mt-0.5 font-mono">
                      ₹{paiseToRupeeDisplay(exception.amountPaise)}
                    </p>
                    <span className="text-[11px] text-[var(--color-on-surface-variant)] mt-1 block font-mono">
                      {exception.amountPaise} integer paise
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                      Priority Attention Score
                    </span>
                    <p className="text-[18px] font-bold text-[var(--color-review)] mt-0.5 font-mono">
                      {exception.priorityScore} / 100
                    </p>
                    <span className="text-[11px] text-[var(--color-on-surface-variant)] mt-1 block">
                      Flagged: {new Date(exception.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Description & Discrepancy Evidence */}
                <div className="p-4 rounded-xl bg-[var(--surface-container-high)] border border-[var(--outline-variant)]">
                  <h3 className="text-[13px] font-semibold text-[var(--color-on-surface)] flex items-center gap-1.5 mb-2">
                    <span className="material-symbols-outlined text-[18px] text-[var(--color-review)]">
                      warning
                    </span>
                    Deterministic Discrepancy & Invariant Findings
                  </h3>
                  <p className="text-[13px] text-[var(--color-on-surface)] leading-relaxed">
                    {exception.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--outline-variant)] text-[11px]">
                    <span className="font-medium text-[var(--color-on-surface-variant)]">Evidence Status:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[color-mix(in_srgb,var(--color-critical)_10%,transparent)] text-[var(--color-critical)] font-medium">
                      <span className="material-symbols-outlined text-[12px]">cancel</span>
                      Missing 3-Way Proof
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-container-lowest)] text-[var(--color-on-surface-variant)] font-medium">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      Zero Guesswork Policy Enforced
                    </span>
                  </div>
                </div>

                {/* 3-Way Source Comparison Grid */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-semibold text-[var(--color-on-surface)] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
                      3-Way Source Correlation Matrix
                    </h3>
                    <span className="text-[11px] text-[var(--color-on-surface-variant)]">
                      {sourceRecords.length} linked record(s) found
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Merchant Card */}
                    <div
                      className={`p-4 rounded-xl border flex flex-col justify-between ${
                        merchantRecord
                          ? "bg-[var(--surface-container-lowest)] border-[var(--outline-variant)]"
                          : "bg-[var(--surface-container-high)]/50 border-dashed border-[var(--outline-variant)]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                            Merchant Books
                          </span>
                          {merchantRecord ? (
                            <span className="text-[10px] font-bold text-[var(--color-explained)] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)]">
                              PRESENT
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-[var(--color-critical)] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--color-critical)_10%,transparent)]">
                              MISSING
                            </span>
                          )}
                        </div>

                        {merchantRecord ? (
                          <div className="space-y-2 text-[12px]">
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Txn ID</span>
                              <span className="font-mono font-medium text-[var(--color-on-surface)] truncate block">
                                {merchantRecord.externalRef}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Gross Amount</span>
                              <span className="font-mono font-bold text-[var(--color-on-surface)]">
                                ₹{paiseToRupeeDisplay(merchantRecord.amountPaise)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Order ID</span>
                              <span className="font-mono text-[var(--color-on-surface)] truncate block">
                                {merchantRecord.orderId || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Occurred At</span>
                              <span className="font-mono text-[11px] text-[var(--color-on-surface)]">
                                {new Date(merchantRecord.occurredAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="py-6 text-center text-[var(--color-on-surface-variant)] text-[12px]">
                            No matching ledger entry recorded in Merchant ERP.
                          </div>
                        )}
                      </div>

                      {merchantRecord && (
                        <button
                          onClick={() => setSelectedRecord(merchantRecord)}
                          className="mt-4 w-full py-1.5 rounded text-[11px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          Inspect Record
                        </button>
                      )}
                    </div>

                    {/* Razorpay Card */}
                    <div
                      className={`p-4 rounded-xl border flex flex-col justify-between ${
                        razorpayRecord
                          ? "bg-[var(--surface-container-lowest)] border-[var(--outline-variant)]"
                          : "bg-[var(--surface-container-high)]/50 border-dashed border-[var(--outline-variant)]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                            Razorpay Gateway
                          </span>
                          {razorpayRecord ? (
                            <span className="text-[10px] font-bold text-[var(--color-explained)] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)]">
                              PRESENT
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-[var(--color-critical)] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--color-critical)_10%,transparent)]">
                              MISSING
                            </span>
                          )}
                        </div>

                        {razorpayRecord ? (
                          <div className="space-y-2 text-[12px]">
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Payment ID</span>
                              <span className="font-mono font-medium text-[var(--color-on-surface)] truncate block">
                                {razorpayRecord.paymentRef || razorpayRecord.externalRef}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Net Settlement</span>
                              <span className="font-mono font-bold text-[var(--color-on-surface)]">
                                ₹{paiseToRupeeDisplay(razorpayRecord.netPaise)}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <div>
                                <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Fee</span>
                                <span className="font-mono text-[11px] text-[var(--color-on-surface)]">
                                  ₹{paiseToRupeeDisplay(razorpayRecord.feePaise)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[var(--color-on-surface-variant)] block">GST</span>
                                <span className="font-mono text-[11px] text-[var(--color-on-surface)]">
                                  ₹{paiseToRupeeDisplay(razorpayRecord.taxPaise)}
                                </span>
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">UTR</span>
                              <span className="font-mono text-[11px] text-[var(--color-on-surface)] truncate block">
                                {razorpayRecord.utr || "—"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="py-6 text-center text-[var(--color-on-surface-variant)] text-[12px]">
                            No matching settlement record found on gateway.
                          </div>
                        )}
                      </div>

                      {razorpayRecord && (
                        <button
                          onClick={() => setSelectedRecord(razorpayRecord)}
                          className="mt-4 w-full py-1.5 rounded text-[11px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          Inspect Record
                        </button>
                      )}
                    </div>

                    {/* Bank Card */}
                    <div
                      className={`p-4 rounded-xl border flex flex-col justify-between ${
                        bankRecord
                          ? "bg-[var(--surface-container-lowest)] border-[var(--outline-variant)]"
                          : "bg-[var(--surface-container-high)]/50 border-dashed border-[var(--outline-variant)]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                            Bank Statement
                          </span>
                          {bankRecord ? (
                            <span className="text-[10px] font-bold text-[var(--color-explained)] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)]">
                              PRESENT
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-[var(--color-critical)] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--color-critical)_10%,transparent)]">
                              MISSING
                            </span>
                          )}
                        </div>

                        {bankRecord ? (
                          <div className="space-y-2 text-[12px]">
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Bank Ref</span>
                              <span className="font-mono font-medium text-[var(--color-on-surface)] truncate block">
                                {bankRecord.externalRef}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Credit Amount</span>
                              <span className="font-mono font-bold text-[var(--color-on-surface)]">
                                ₹{paiseToRupeeDisplay(bankRecord.amountPaise)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">UTR / Ref</span>
                              <span className="font-mono text-[11px] text-[var(--color-on-surface)] truncate block">
                                {bankRecord.utr || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--color-on-surface-variant)] block">Date</span>
                              <span className="font-mono text-[11px] text-[var(--color-on-surface)]">
                                {new Date(bankRecord.occurredAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="py-6 text-center text-[var(--color-on-surface-variant)] text-[12px]">
                            No corresponding bank deposit / debit credit found.
                          </div>
                        )}
                      </div>

                      {bankRecord && (
                        <button
                          onClick={() => setSelectedRecord(bankRecord)}
                          className="mt-4 w-full py-1.5 rounded text-[11px] font-medium bg-[var(--surface-container-high)] text-[var(--color-on-surface)] hover:bg-[var(--surface-container-highest)] transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          Inspect Record
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Investigation Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-semibold text-[var(--color-on-surface)] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">psychology</span>
                      AI-Assisted Investigation
                    </h3>
                    {!investigation && (
                      <button
                        onClick={handleInvestigate}
                        disabled={investigating}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
                      >
                        {investigating ? (
                          <>
                            <span className="material-symbols-outlined text-[14px] animate-spin">
                              progress_activity
                            </span>
                            Investigating...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[14px]">psychology</span>
                            Run AI Investigation
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {investigationError && (
                    <div className="p-3 rounded-lg bg-[color-mix(in_srgb,var(--color-critical)_10%,transparent)] border border-[var(--color-critical)]/30 text-[12px]">
                      <p className="font-medium text-[var(--color-critical)]">Investigation Error</p>
                      <p className="text-[11px] mt-1 text-[var(--color-on-surface-variant)]">
                        {investigationError}
                      </p>
                    </div>
                  )}

                  {!investigation && !investigating && !investigationError && (
                    <div className="p-4 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] text-center">
                      <p className="text-[12px] text-[var(--color-on-surface-variant)] mb-2">
                        No AI investigation performed yet. Click above to trigger investigation.
                      </p>
                      <p className="text-[11px] text-[var(--color-on-surface-variant)]">
                        AI will analyze evidence and propose hypotheses, subject to deterministic verification.
                      </p>
                    </div>
                  )}

                  {investigation && (
                    <div className="space-y-3">
                      {/* Verification Status Banner */}
                      <div
                        className={`p-3 rounded-lg border ${
                          investigation.verificationStatus === 'AI_SUPPORTED'
                            ? 'bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)] border-[var(--color-explained)]/30'
                            : investigation.verificationStatus === 'AI_REJECTED'
                            ? 'bg-[color-mix(in_srgb,var(--color-critical)_10%,transparent)] border-[var(--color-critical)]/30'
                            : investigation.verificationStatus === 'INCONCLUSIVE'
                            ? 'bg-[color-mix(in_srgb,var(--color-review)_10%,transparent)] border-[var(--color-review)]/30'
                            : 'bg-[var(--surface-container-lowest)] border-[var(--outline-variant)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider">
                            Verification Status
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              investigation.verificationStatus === 'AI_SUPPORTED'
                                ? 'bg-[var(--color-explained)] text-white'
                                : investigation.verificationStatus === 'AI_REJECTED'
                                ? 'bg-[var(--color-critical)] text-white'
                                : investigation.verificationStatus === 'INCONCLUSIVE'
                                ? 'bg-[var(--color-review)] text-white'
                                : 'bg-[var(--surface-container-highest)] text-[var(--color-on-surface-variant)]'
                            }`}
                          >
                            {investigation.verificationStatus}
                          </span>
                        </div>
                        <p className="text-[12px] text-[var(--color-on-surface)]">
                          {investigation.verificationDetails}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-on-surface-variant)]">
                          <span>Provider: {investigation.provider}</span>
                          <span>Model: {investigation.model}</span>
                          {investigation.tokensUsed && <span>Tokens: {investigation.tokensUsed}</span>}
                          <span>{new Date(investigation.timestamp).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* AI Hypothesis */}
                      <div className="p-4 rounded-lg bg-[var(--surface-container-high)] border border-[var(--outline-variant)]">
                        <h4 className="text-[12px] font-semibold text-[var(--color-on-surface)] mb-2 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                          AI Hypothesis
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-[10px] font-medium text-[var(--color-on-surface-variant)] uppercase block">
                              Conclusion
                            </span>
                            <span className="text-[12px] font-bold text-[var(--color-on-surface)] uppercase">
                              {investigation.aiOutput.conclusion}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-[var(--color-on-surface-variant)] uppercase block">
                              Summary
                            </span>
                            <p className="text-[12px] text-[var(--color-on-surface)] leading-relaxed">
                              {investigation.aiOutput.summary}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Evidence */}
                      {investigation.aiOutput.evidence.length > 0 && (
                        <div className="p-3 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                          <h4 className="text-[11px] font-semibold text-[var(--color-on-surface)] mb-2">
                            Evidence Cited
                          </h4>
                          <ul className="space-y-1">
                            {investigation.aiOutput.evidence.map((e, idx) => (
                              <li key={idx} className="text-[11px] text-[var(--color-on-surface)] flex gap-2">
                                <span className="text-[var(--color-on-surface-variant)]">•</span>
                                <span>{e}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Discrepancies */}
                      {investigation.aiOutput.discrepancies.length > 0 && (
                        <div className="p-3 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]">
                          <h4 className="text-[11px] font-semibold text-[var(--color-on-surface)] mb-2">
                            Observed Discrepancies
                          </h4>
                          <div className="space-y-2">
                            {investigation.aiOutput.discrepancies.map((d, idx) => (
                              <div key={idx} className="text-[11px]">
                                <span className="font-medium text-[var(--color-on-surface)]">{d.field}:</span>{' '}
                                <span className="text-[var(--color-on-surface-variant)]">{d.observation}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommended Action */}
                      <div className="p-3 rounded-lg bg-[var(--surface-container-high)] border border-[var(--outline-variant)]">
                        <h4 className="text-[11px] font-semibold text-[var(--color-on-surface)] mb-1">
                          Recommended Action
                        </h4>
                        <p className="text-[12px] text-[var(--color-on-surface)]">
                          {investigation.aiOutput.recommendedAction}
                        </p>
                      </div>

                      {/* Warning Notice */}
                      <div className="p-3 rounded-lg bg-[color-mix(in_srgb,var(--color-review)_10%,transparent)] border border-[var(--color-review)]/30">
                        <p className="text-[11px] text-[var(--color-on-surface)] flex items-start gap-2">
                          <span className="material-symbols-outlined text-[14px] text-[var(--color-review)] mt-0.5">
                            info
                          </span>
                          <span>
                            <strong>Important:</strong> AI hypothesis is NOT financial truth. All claims have been
                            deterministically verified. Only verification status determines acceptance.
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Exception Audit Events */}
                {auditEvents.length > 0 && (
                  <div>
                    <h3 className="text-[13px] font-semibold text-[var(--color-on-surface)] mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">history</span>
                      Audit Log & Investigation History
                    </h3>
                    <div className="space-y-2">
                      {auditEvents.map((evt, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] text-[12px]"
                        >
                          <div className="flex items-center justify-between text-[11px] text-[var(--color-on-surface-variant)] mb-1">
                            <span className="font-mono font-medium uppercase text-[var(--color-on-surface)]">
                              {evt.eventType}
                            </span>
                            <span>{new Date(evt.occurredAt).toLocaleString()}</span>
                          </div>
                          <p className="text-[var(--color-on-surface)]">{evt.reason}</p>
                          {evt.evidence && (
                            <p className="mt-1 text-[11px] font-mono text-[var(--color-on-surface-variant)] bg-[var(--surface-container)] p-2 rounded">
                              {evt.evidence}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--outline-variant)] bg-[var(--surface-container-high)]">
            <span className="text-[11px] text-[var(--color-on-surface-variant)] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              Immutable Audit Preserved
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--surface-container-highest)] text-[var(--color-on-surface)] hover:bg-[var(--outline)]/20 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Detail Sub-Modal */}
      {selectedRecord && (
        <TransactionDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
    </>
  );
}
