import { cn } from "@presentation/lib/cn";
import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark",
  secondary:
    "bg-secondary-bg text-heading border border-default hover:bg-page",
} as const;

type LinkButtonProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    variant?: keyof typeof variants;
    fullWidth?: boolean;
  };

export function LinkButton({
  className,
  variant = "primary",
  fullWidth,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
