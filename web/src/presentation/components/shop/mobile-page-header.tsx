"use client";

import { cn } from "@presentation/lib/cn";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type MobilePageHeaderProps = {
  title: string;
  fallbackHref?: string;
  className?: string;
  containerClassName?: string;
  showNotificationDot?: boolean;
  sticky?: boolean;
  backAriaLabel?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  children?: ReactNode;
};

function BackArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function MobilePageHeader({
  title,
  fallbackHref = "/",
  className = "",
  containerClassName,
  showNotificationDot = true,
  sticky = true,
  backAriaLabel = "Go back",
  onBack,
  rightAction,
  children,
}: MobilePageHeaderProps) {
  const router = useRouter();

  function goBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <div
      className={cn(
        sticky && "sticky top-0 z-40 backdrop-blur",
        sticky &&
          !containerClassName &&
          "-mx-4 border-b border-catalog-border/60 bg-catalog-surface/95 px-4 py-3 sm:mx-0",
        containerClassName,
      )}
    >
      <header
        className={cn(
          "grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2",
          className,
        )}
      >
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-catalog-text transition-colors hover:bg-black/5"
          aria-label={backAriaLabel}
          onClick={goBack}
        >
          <BackArrowIcon className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 truncate text-center text-sm font-semibold tracking-tight text-catalog-text">
          {title}
        </h1>
        {rightAction ?? (
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-catalog-text transition-colors hover:bg-black/5"
            aria-label="Notifications"
          >
            <BellIcon className="h-5 w-5" />
            {showNotificationDot ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-catalog-surface bg-catalog-green" />
            ) : null}
          </button>
        )}
      </header>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
