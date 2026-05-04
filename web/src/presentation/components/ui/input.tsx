import { cn } from "@presentation/lib/cn";
import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? (
        <span className="font-medium text-heading">{label}</span>
      ) : null}
      <input
        id={inputId}
        className={cn(
          "min-h-11 w-full rounded-lg border border-input-border bg-input-bg px-3 text-heading outline-none transition-shadow placeholder:text-input-placeholder",
          "focus:border-border-focus focus:ring-2 focus:ring-primary/20",
          error && "border-red-400 focus:ring-red-200",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
