import { cn } from "@presentation/lib/cn";
import type { HTMLAttributes } from "react";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-default bg-card p-4 shadow-sm sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
