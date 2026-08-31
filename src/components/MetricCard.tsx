interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendIcon?: string;
  trendColor?: "green" | "amber" | "red" | "muted";
  indicator?: boolean;
  accentVar?: string; // CSS variable name, e.g. "--color-explained"
}

const TREND_CLASSES: Record<string, string> = {
  green: "text-[var(--color-explained)]",
  amber: "text-[var(--color-review)]",
  red: "text-[var(--color-critical)]",
  muted: "text-[var(--color-on-surface-variant)]",
};

export function MetricCard({
  label,
  value,
  sub,
  trend,
  trendIcon,
  trendColor = "muted",
  indicator = false,
  accentVar,
}: MetricCardProps) {
  const gradFrom = accentVar
    ? `from-[color-mix(in_srgb,var(${accentVar})_5%,transparent)]`
    : "from-[color-mix(in_srgb,var(--color-primary)_5%,transparent)]";

  return (
    <div className="bg-[var(--surface-container-low)] rounded-xl p-4 flex flex-col relative overflow-hidden group">
      {/* Hover gradient overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradFrom} to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}
      />

      <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-on-surface-variant)] mb-2 flex items-center justify-between w-full">
        {label}
        {indicator && (
          <span className="w-2 h-2 rounded-full bg-[var(--color-review)]" />
        )}
      </span>

      <div className="flex items-baseline gap-2">
        <span className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em] text-[var(--color-on-surface)] tabular-nums">
          {value}
        </span>
        {sub && (
          <span className="text-[13px] leading-[18px] text-[var(--color-on-surface-variant)] tabular-nums">
            {sub}
          </span>
        )}
      </div>

      {(trend || trendIcon) && (
        <div className={`flex items-center gap-1 mt-2 ${TREND_CLASSES[trendColor]}`}>
          {trendIcon && (
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              {trendIcon}
            </span>
          )}
          {trend && (
            <span className="text-[13px] leading-[18px]">{trend}</span>
          )}
        </div>
      )}
    </div>
  );
}
