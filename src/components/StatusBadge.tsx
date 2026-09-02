import type { RunStatus, ExceptionSeverity, SourceStatus } from "@/data/mock";

interface StatusBadgeProps {
  status: RunStatus | ExceptionSeverity | SourceStatus | string;
  className?: string;
}

type ColorConfig = {
  bg: string;
  text: string;
  border?: string;
};

function getConfig(status: string): ColorConfig {
  const s = status.toLowerCase();
  if (s === "completed" || s === "validated" || s === "matched" || s === "confirmed" || s === "success") {
    return { bg: "bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)]", text: "text-[var(--color-explained)]", border: "border border-[color-mix(in_srgb,var(--color-explained)_20%,transparent)]" };
  }
  if (s === "ready" || s === "partial_match" || s === "explained") {
    return { bg: "bg-[color-mix(in_srgb,var(--color-secondary-container)_60%,transparent)]", text: "text-[var(--color-on-secondary-container)]" };
  }
  if (s === "failed" || s === "error" || s === "critical" || s === "p1 critical" || s === "p1" || s === "invalid") {
    return {
      bg: "bg-[color-mix(in_srgb,var(--color-critical)_10%,transparent)]",
      text: "text-[var(--color-critical)]",
      border: "border border-[color-mix(in_srgb,var(--color-critical)_20%,transparent)]",
    };
  }
  if (s === "high" || s === "p2 high" || s === "p2" || s === "review" || s === "exception") {
    return {
      bg: "bg-[color-mix(in_srgb,var(--color-review)_10%,transparent)]",
      text: "text-[var(--color-review)]",
      border: "border border-[color-mix(in_srgb,var(--color-review)_20%,transparent)]",
    };
  }
  if (s === "running" || s === "medium" || s === "p3 medium" || s === "p3") {
    return { bg: "bg-[color-mix(in_srgb,var(--color-on-surface-variant)_12%,transparent)]", text: "text-[var(--color-on-surface-variant)]", border: "border border-[color-mix(in_srgb,var(--color-on-surface-variant)_20%,transparent)]" };
  }
  if (s === "low" || s === "p4 low" || s === "p4" || s === "preview") {
    return { bg: "bg-[var(--surface-container-high)]", text: "text-[var(--color-on-surface-variant)]" };
  }
  if (s === "unresolved" || s === "unmatched") {
    return { bg: "bg-[color-mix(in_srgb,var(--color-unresolved)_15%,transparent)]", text: "text-[var(--color-unresolved)]", border: "border border-[color-mix(in_srgb,var(--color-unresolved)_25%,transparent)]" };
  }
  return { bg: "bg-[var(--surface-container-high)]", text: "text-[var(--color-on-surface-variant)]" };
}

const LABELS: Record<string, string> = {
  completed: "Completed",
  failed: "Failed",
  running: "Running",
  pending: "Pending",
  validated: "Validated",
  ready: "Ready",
  not_added: "Not Added",
  error: "Error",
  critical: "P1 Critical",
  high: "P2 High",
  medium: "P3 Medium",
  low: "P4 Low",
  MATCHED: "Matched",
  EXPLAINED: "Explained",
  UNRESOLVED: "Unresolved",
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const { bg, text, border = "" } = getConfig(status);
  const label = LABELS[status] ?? LABELS[status.toLowerCase()] ?? status;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${bg} ${text} ${border} ${className}`}
    >
      {label}
    </span>
  );
}
