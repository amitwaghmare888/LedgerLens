import type { ReconciliationSource } from "@/data/mock";

interface SourceCardProps {
  source: ReconciliationSource;
  onRemove?: (id: string) => void;
  onReplace?: (id: string) => void;
  onUpload?: (id: string) => void;
}

const ACCENT: Record<string, string> = {
  merchant: "--color-explained",
  razorpay: "--color-primary",
  bank: "--color-on-surface-variant",
};

export function SourceCard({ source, onRemove, onReplace, onUpload }: SourceCardProps) {
  const accent = ACCENT[source.id] ?? "--color-on-surface-variant";
  const isNotAdded = source.status === "not_added";

  if (isNotAdded) {
    return (
      <button
        onClick={() => onUpload?.(source.id)}
        className="flex flex-col bg-[var(--surface-container-highest)] rounded-xl p-6 gap-6 relative justify-center items-center text-center cursor-pointer hover:bg-[var(--surface-variant)] transition-colors w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        aria-label={`Upload ${source.label}`}
      >
        <div className="w-16 h-16 rounded-full bg-[var(--surface)] shadow-sm flex items-center justify-center mb-2">
          <span className="material-symbols-outlined text-[32px] text-[var(--color-on-surface-variant)]">
            upload_file
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[16px] leading-[24px] font-medium text-[var(--color-on-surface)]">
            {source.label}
          </h3>
          <p className="text-[13px] leading-[18px] text-[var(--color-on-surface-variant)] max-w-[200px]">
            Drag and drop PDF or CSV statements here
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-[var(--surface)] shadow-sm text-[var(--color-on-surface-variant)] text-[11px] font-bold uppercase tracking-[0.05em] mt-4">
          Not Added
        </span>
      </button>
    );
  }

  const statusLabel =
    source.status === "validated"
      ? "Validated"
      : source.status === "ready"
        ? "Ready"
        : source.status;
  const statusIcon =
    source.status === "validated" ? "check_circle" : "bolt";
  const statusBg =
    source.status === "validated"
      ? "bg-[color-mix(in_srgb,var(--color-explained)_10%,transparent)] text-[var(--color-explained)]"
      : "bg-[var(--secondary-container)] text-[var(--color-on-secondary-container)]";

  return (
    <div className="flex flex-col bg-[var(--surface-container-low)] shadow-sm rounded-xl p-6 gap-6 relative overflow-hidden group">
      {/* Decorative accent */}
      <div
        className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-30"
        style={{ backgroundColor: `var(${accent})` }}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--surface)] flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">
              {source.icon}
            </span>
          </div>
          <div className="flex flex-col">
            <h3 className="text-[16px] leading-[24px] font-medium text-[var(--color-on-surface)]">
              {source.label}
            </h3>
            {source.sublabel && (
              <span className="text-[13px] text-[var(--color-on-surface-variant)]">
                {source.sublabel}
              </span>
            )}
          </div>
        </div>

        <span className={`px-2.5 py-1 rounded-md ${statusBg} text-[11px] font-bold uppercase tracking-[0.05em] flex items-center gap-1`}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
            {statusIcon}
          </span>
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-col gap-4 flex-1 justify-center">
        {source.filename && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-on-surface-variant)]">
              Filename
            </span>
            <span className="font-mono text-[13px] font-medium text-[var(--color-on-surface)] bg-[var(--surface)] px-2 py-1 rounded shadow-sm self-start">
              {source.filename}
            </span>
          </div>
        )}
        {source.recordCount != null && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-on-surface-variant)]">
              Records
            </span>
            <span className="font-mono text-[18px] font-medium text-[var(--color-on-surface)] tabular-nums">
              {source.recordCount.toLocaleString("en-IN")}
            </span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 -mx-6 -mb-6 px-6 py-3 bg-[var(--surface-container-high)] mt-auto">
        <button
          onClick={() => {}}
          aria-label={`Preview ${source.label}`}
          title="Preview not yet available"
          disabled
          className="text-[13px] text-[var(--color-on-surface-variant)] opacity-50 cursor-not-allowed flex items-center gap-1"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>visibility</span>
          Preview
        </button>
        <div className="w-px h-4 bg-[var(--surface-variant)] mx-2" />
        <button
          onClick={() => onReplace?.(source.id)}
          className="text-[13px] text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors"
        >
          Replace
        </button>
        <button
          onClick={() => onRemove?.(source.id)}
          className="text-[13px] text-[var(--color-critical)] hover:opacity-75 transition-opacity ml-auto"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
