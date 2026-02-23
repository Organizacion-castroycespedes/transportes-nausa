import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
};

export const Select = ({ label, hint, children, className, ...props }: SelectProps) => {
  return (
    <label className="flex flex-col gap-2 text-sm text-foreground">
      <span className="font-medium">
        {label}
        {props.required ? <span className="text-primary"> *</span> : null}
      </span>
      <select
        {...props}
        className={`w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 ${className ?? ""}`}
      >
        {children}
      </select>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
};
