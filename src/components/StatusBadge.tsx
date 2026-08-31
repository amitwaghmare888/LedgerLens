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
  switch (status) {
    case "completed":
    case "validated":
      return { bg: "bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)]", text: "text-[var(--color-explained)]" };
    case "ready":
      return { bg: "bg-[color-mix(in_srgb,var(--color-secondary-container)_60%,transparent)]", text: "text-[var(--color-on-secondary-container)]" };
    case "failed":
    case "error":
    case "P1 Critical":
      return {
        bg: "bg-[color-mix(in_srgb,var(--color-critical)_10%,transparent)]",
        text: "text-[var(--color-critical)]",
        border: "border border-[color-mix(in_srgb,var(--color-critical)_20%,transparent)]",
      };
    case "P2 High":
      return {
        bg: "bg-[color-mix(in_srgb,var(--color-review)_10%,transparent)]",
        text: "text-[var(--color-review)]",
        border: "border border-[color-mix(in_srgb,var(--color-review)_20%,transparent)]",
      };
    case "running":
    case "P3 Medium":
      return { bg: "bg-[color-mix(in_srgb,var(--color-on-surface-variant)_10%,transparent)]", text: "text-[var(--color-on-surface-variant)]" };
    case "not_added":
    case "pending":
    default:
      return { bg: "bg-[var(--surface-container-high)]", text: "text-[var(--color-on-surface-variant)]" };
  }
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
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const { bg, text, border = "" } = getConfig(status);
  const label = LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${bg} ${text} ${border} ${className}`}
    >
      {label}
    </span>
  );
}
