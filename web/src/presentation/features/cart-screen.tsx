"use client";

import { cartTotalCents } from "@domain/cart";
import { MobilePageHeader } from "@presentation/components/shop/mobile-page-header";
import { LinkButton } from "@presentation/components/ui/link-button";
import { cn } from "@presentation/lib/cn";
import { formatMoney } from "@presentation/lib/format-money";
import { useCartStore } from "@presentation/state/cart-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

/** Placeholder wholesale free-delivery threshold (matches mock scale). */
const FREE_DELIVERY_THRESHOLD_CENTS = 250_00;
/** Rough est. tax rate used in mock (~8.2%). */
const EST_TAX_RATE = 0.082;

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={10}
      height={10}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CartScreen() {
  const router = useRouter();
  const lines = useCartStore((s) => s.lines);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const [notesByProduct, setNotesByProduct] = useState<Record<string, string>>(
    {},
  );

  const itemCount = useMemo(
    () => lines.reduce((n, l) => n + l.quantity, 0),
    [lines],
  );
  const cartCurrency = lines[0]?.currency ?? "USD";
  const subtotalCents = useMemo(() => cartTotalCents(lines), [lines]);
  const estTaxCents = Math.round(subtotalCents * EST_TAX_RATE);
  const totalWithTaxCents = subtotalCents + estTaxCents;
  const freeProgress =
    FREE_DELIVERY_THRESHOLD_CENTS > 0
      ? Math.min(
          100,
          Math.round((subtotalCents / FREE_DELIVERY_THRESHOLD_CENTS) * 100),
        )
      : 0;
  const remainingForFree = Math.max(
    0,
    FREE_DELIVERY_THRESHOLD_CENTS - subtotalCents,
  );

  if (lines.length === 0) {
    return (
      <div className="relative -mx-4 flex flex-col overflow-hidden rounded-2xl border border-default bg-card shadow-sm sm:mx-0">
        <MobilePageHeader
          title="Cart"
          fallbackHref="/catalog"
          containerClassName="mx-0 border-b border-default/60 bg-page px-4 py-3"
        />
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <svg
              width={32}
              height={32}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                d="M6 6h15l-1.5 9h-12L6 6Zm0 0-.75-3H3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-heading">Your cart is empty</h2>
          <p className="mt-2 max-w-xs text-sm text-secondary">
            Browse the catalog and add items. Use quick search on the home page
            to find SKUs.
          </p>
          <LinkButton href="/" className="mt-8" fullWidth>
            Browse products
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="relative -mx-4 flex min-h-[min(85dvh,40rem)] flex-col overflow-hidden">
      <MobilePageHeader
        title="Cart"
        fallbackHref="/catalog"
        containerClassName="mx-0 shrink-0 border-b border-default/60 bg-page px-4 py-3"
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(12rem+env(safe-area-inset-bottom))] lg:pb-8">
        <section className="border-b border-default/50 bg-card px-4 py-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              readOnly
              placeholder="Quick add by SKU or name…"
              className="h-10 w-full cursor-not-allowed rounded-lg border border-default/60 bg-input-bg pl-9 pr-[4.25rem] text-sm text-heading placeholder:text-muted"
              aria-label="Quick add (browse catalog to add items)"
            />
            <Link
              href="/"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary px-2 py-1.5 text-[10px] font-bold text-white hover:bg-primary-dark"
            >
              Add
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-2 p-3">
          {lines.map((line) => {
            const lineTotal = line.unitPriceCents * line.quantity;
            const productHref = `/products/${line.productId}`;
            return (
              <article
                key={line.productId}
                role="link"
                tabIndex={0}
                aria-label={`View ${line.title}`}
                className="flex cursor-pointer flex-col gap-3 rounded-xl border border-default/60 bg-card p-3 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                onClick={() => router.push(productHref)}
                onKeyDown={(event) => {
                  if (event.currentTarget !== event.target) return;
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  router.push(productHref);
                }}
              >
                <div className="flex gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-default/40 bg-secondary-bg p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.imageUrl}
                      alt=""
                      className="h-full w-full object-contain mix-blend-multiply"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <h3 className="line-clamp-2 text-xs font-bold leading-tight text-heading">
                        {line.title}
                      </h3>
                      <div className="mb-0.5 flex items-start justify-between gap-2">
                        <div className="flex shrink-0 items-center gap-1">
                          <Link
                            href={productHref}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-secondary-bg hover:text-primary"
                            aria-label={`Edit ${line.title}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <PenIcon />
                          </Link>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-secondary-bg hover:text-heading"
                            aria-label={`Remove ${line.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeLine(line.productId);
                            }}
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-muted">Line total</span>
                      <span className="text-sm font-bold text-heading">
                        {formatMoney(lineTotal, line.currency)}
                      </span>
                    </div>
                    {line.pricingSource === "SPECIAL" ? (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="rounded bg-primary-light px-1.5 py-0.5 text-[9px] font-bold text-primary">
                          {line.specialPricingLabel ?? "Special price for you"}
                        </span>
                        {line.originalUnitPriceCents ? (
                          <span className="text-[10px] text-muted line-through">
                            {formatMoney(
                              line.originalUnitPriceCents,
                              line.currency,
                            )}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div
                  className="flex items-center justify-between rounded-lg border border-default/40 bg-secondary-bg/80 p-1.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-default bg-card text-muted shadow-sm transition-colors hover:text-heading"
                      aria-label="Decrease quantity"
                      onClick={(event) => {
                        event.stopPropagation();
                        setQuantity(line.productId, line.quantity - 1);
                      }}
                    >
                      <span className="text-xs font-bold">−</span>
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-heading">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-default bg-card text-heading shadow-sm transition-colors hover:bg-secondary-bg"
                      aria-label="Increase quantity"
                      onClick={(event) => {
                        event.stopPropagation();
                        setQuantity(line.productId, line.quantity + 1);
                      }}
                    >
                      <span className="text-xs font-bold">+</span>
                    </button>
                  </div>
                  <span className="text-[10px] font-medium text-muted">
                    Qty
                  </span>
                </div>

                <div className="border-t border-default/40 pt-2">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded bg-success-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success">
                      <CheckCircleIcon />
                      In stock
                    </span>
                  </div>
                  <div className="relative">
                    <CommentIcon className="pointer-events-none absolute left-2 top-2 text-muted" />
                    <input
                      type="text"
                      placeholder="Add handling or substitution notes…"
                      value={notesByProduct[line.productId] ?? ""}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(e) =>
                        setNotesByProduct((prev) => ({
                          ...prev,
                          [line.productId]: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-default/60 bg-input-bg py-1.5 pl-6 pr-2 text-[10px] text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-2 border-y border-default/50 bg-card px-4 py-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-heading">
            <TruckIcon className="text-primary" />
            Delivery details
          </h2>
          <div className="mb-4 rounded-[10px] border border-default/60 bg-secondary-bg/80 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-heading">
                Estimated delivery
              </span>
              <span className="rounded bg-success-bg px-2 py-0.5 text-[10px] font-bold text-success">
                Free slot
              </span>
            </div>
            <p className="text-sm font-bold text-primary">
              1–2 business days after dispatch
            </p>
            <p className="mt-1 text-[10px] text-muted">
              Final date and window are confirmed at checkout.
            </p>
          </div>
          <div>
            <div className="mb-1.5 flex items-end justify-between">
              <span className="text-xs font-semibold text-heading">
                Minimum for free delivery
              </span>
              <span className="text-xs font-bold text-heading">
                {formatMoney(subtotalCents, cartCurrency)} /{" "}
                {formatMoney(FREE_DELIVERY_THRESHOLD_CENTS, cartCurrency)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-input-bg">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${freeProgress}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted">
              {remainingForFree === 0
                ? "You qualify for free delivery on this threshold."
                : `Add ${formatMoney(remainingForFree, cartCurrency)} more to qualify`}
            </p>
          </div>
        </section>
      </div>

      <div
        className={cn(
          "sticky z-30 border-t border-default bg-card px-4 py-4 shadow-[0_-10px_20px_rgba(0,0,0,0.06)]",
          "bottom-[calc(3.25rem+env(safe-area-inset-bottom))] lg:bottom-0",
        )}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">
            Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
          </span>
          <span className="text-sm font-semibold text-heading">
            {formatMoney(subtotalCents, cartCurrency)}
          </span>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">
            Est. taxes &amp; fees
          </span>
          <span className="text-sm font-semibold text-heading">
            {formatMoney(estTaxCents, cartCurrency)}
          </span>
        </div>
        <div className="mb-4 flex items-center justify-between border-t border-default/40 pt-2">
          <span className="text-sm font-bold text-heading">Total</span>
          <span className="text-xl font-bold text-primary">
            {formatMoney(totalWithTaxCents, cartCurrency)}
          </span>
        </div>
        <LinkButton
          href="/checkout"
          fullWidth
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] text-sm font-bold shadow-md"
        >
          Proceed to checkout
          <ChevronRightIcon />
        </LinkButton>
      </div>
    </div>
  );
}
