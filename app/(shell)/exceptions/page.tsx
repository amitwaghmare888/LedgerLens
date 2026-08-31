import type { Metadata } from "next";

export const metadata: Metadata = { title: "Exception Queue — LedgerLens" };

export default function ExceptionsPage() {
  return (
    <div className="flex flex-col w-full px-6 py-10 gap-6">
      <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-on-surface)]">
        Exception Queue
      </h1>
      <div className="flex flex-col items-center justify-center py-24 text-[var(--color-on-surface-variant)] gap-4">
        <span className="material-symbols-outlined" style={{ fontSize: "48px", opacity: 0.3 }}>
          report
        </span>
        <p className="text-[14px]">Exception Queue — coming in Phase 2</p>
      </div>
    </div>
  );
}
