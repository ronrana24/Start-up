"use client";

import type { Order } from "@domain/order";
import { Button } from "@presentation/components/ui/button";
import { cn } from "@presentation/lib/cn";
import {
  downloadOrderInvoicePdf,
  type DownloadOrderInvoicePdfOptions,
} from "@presentation/lib/order-invoice-pdf";
import { useCallback, useState, type ReactNode } from "react";

type DownloadOrderInvoiceButtonProps = {
  order: Order;
  className?: string;
  /** Applied to the outer wrapper (e.g. `flex-1` in a flex row). */
  rootClassName?: string;
  fullWidth?: boolean;
  variant?: "primary" | "secondary";
  children?: ReactNode;
  pdfOptions?: DownloadOrderInvoicePdfOptions;
};

export function DownloadOrderInvoiceButton({
  order,
  className,
  rootClassName,
  fullWidth,
  variant = "secondary",
  children = "Download invoice / receipt",
  pdfOptions,
}: DownloadOrderInvoiceButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(() => {
    setError(null);
    setPending(true);
    try {
      downloadOrderInvoicePdf(order, pdfOptions);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate PDF";
      setError(msg);
    } finally {
      setPending(false);
    }
  }, [order, pdfOptions]);

  return (
    <div className={cn(fullWidth && "w-full", rootClassName)}>
      <Button
        type="button"
        variant={variant}
        fullWidth={fullWidth}
        disabled={pending}
        onClick={onClick}
        className={cn(
          variant === "secondary" &&
            "border border-default text-xs font-semibold text-primary",
          className,
        )}
      >
        {pending ? "Preparing PDF…" : children}
      </Button>
      {error ? (
        <p className="mt-1 text-center text-[11px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
