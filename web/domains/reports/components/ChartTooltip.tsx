type ChartTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
};

export const ChartTooltip = ({ active, label, payload }: ChartTooltipProps) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-sm">
      {label ? <p className="mb-1 font-semibold">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`${entry.name ?? "item"}-${index}`} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color ?? "var(--color-primary)" }}
              />
              <span>{entry.name ?? "Valor"}</span>
            </span>
            <span className="font-semibold">{entry.value ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
