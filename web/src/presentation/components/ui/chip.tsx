import { cn } from "@presentation/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function Chip({ active, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      className={cn(
        "min-h-9 rounded-full px-3 text-sm font-medium transition-colors",
        active
          ? "bg-chip-active text-white"
          : "bg-chip-inactive text-chip-inactive-text",
        className,
      )}
      {...props}
    />
  );
}
