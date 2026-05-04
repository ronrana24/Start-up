import { cn } from "@presentation/lib/cn";
import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark disabled:bg-disabled-bg disabled:text-disabled-text",
  secondary:
    "bg-secondary-bg text-heading border border-default hover:bg-page",
  ghost: "text-secondary hover:bg-secondary-bg",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  fullWidth?: boolean;
};

export function Button({
  className,
  variant = "primary",
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
