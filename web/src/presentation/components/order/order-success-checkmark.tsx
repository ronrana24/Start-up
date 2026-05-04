import { cn } from "@presentation/lib/cn";

type OrderSuccessCheckmarkProps = {
  className?: string;
};

/** Animated success ring + drawn check (see globals.css `order-success-*`). */
export function OrderSuccessCheckmark({ className }: OrderSuccessCheckmarkProps) {
  return (
    <div
      className={cn(
        "order-success-glyph flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-success-bg",
        className,
      )}
      aria-hidden
    >
      <svg
        className="h-9 w-9 text-success"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="order-success-check-path"
          d="M14 25.5 21 32.5 35 17.5"
          pathLength={1}
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
