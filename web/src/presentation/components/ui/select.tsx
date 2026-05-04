import { cn } from "@presentation/lib/cn";
import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? (
        <span className="font-medium text-heading">{label}</span>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "min-h-11 w-full appearance-none rounded-lg border border-input-border bg-input-bg px-3 pr-9 text-heading outline-none transition-shadow",
            "focus:border-border-focus focus:ring-2 focus:ring-primary/20",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error && "border-red-400 focus:ring-red-200",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary"
          aria-hidden
        >
          ▾
        </span>
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
