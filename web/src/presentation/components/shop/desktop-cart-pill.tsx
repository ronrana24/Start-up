"use client";

import { cartTotalCents } from "@domain/cart";
import { formatMoney } from "@presentation/lib/format-money";
import { useCartStore } from "@presentation/state/cart-store";
import Link from "next/link";
import { NavCartIcon } from "./nav-icons";

export function DesktopCartPill() {
  const lines = useCartStore((s) => s.lines);
  const cartCaseCount = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotalCents = cartTotalCents(lines);
  const currency = lines[0]?.currency ?? "INR";

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 mb-2 hidden px-4 lg:block">
      <div className="pointer-events-auto mx-auto max-w-lg">
        <div className="catalog-cart-pill flex items-center justify-between rounded-2xl border border-catalog-blue-light/20 bg-catalog-blue p-3 shadow-[var(--shadow-catalog-cart)]">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <NavCartIcon className="h-4 w-4 text-white" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-catalog-blue bg-catalog-green text-[9px] font-bold text-white">
                {cartCaseCount > 99 ? "99+" : cartCaseCount}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                Subtotal
              </p>
              <p className="text-sm font-bold text-white">
                {formatMoney(subtotalCents, currency)}
              </p>
            </div>
          </div>
          <Link
            href="/cart"
            className="flex items-center gap-2 rounded-[10px] bg-white px-4 py-2 text-xs font-bold text-catalog-blue transition-colors hover:bg-catalog-surface"
          >
            View Cart
            <ArrowRightIcon className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
