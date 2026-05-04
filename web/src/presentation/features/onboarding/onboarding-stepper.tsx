import { cn } from "@presentation/lib/cn";

type OnboardingStepperProps = {
  /** Zero-based index of the current step (0 = welcome … 2 = address). */
  activeIndex: number;
  total: number;
  className?: string;
};

export function OnboardingStepper({
  activeIndex,
  total,
  className,
}: OnboardingStepperProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center gap-2 px-1 py-3",
        className,
      )}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i <= activeIndex ? "bg-primary" : "bg-default",
          )}
        />
      ))}
      <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-muted">
        Step {activeIndex + 1}/{total}
      </span>
    </div>
  );
}
