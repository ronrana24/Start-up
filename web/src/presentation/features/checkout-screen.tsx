"use client";

import { cartTotalCents } from "@domain/cart";
import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { Input } from "@presentation/components/ui/input";
import { usePlaceOrderMutation } from "@presentation/hooks/use-place-order-mutation";
import { cn } from "@presentation/lib/cn";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import { formatMoney } from "@presentation/lib/format-money";
import { useAuthStore } from "@presentation/state/auth-store";
import { useCartStore } from "@presentation/state/cart-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";

const EST_TAX_RATE = 0.082;

type CheckoutStep = 1 | 2;
type PaymentMode = "upi" | "cod";
type DeliverySlot = "morning" | "afternoon";

type DeliveryDateOption = {
  id: string;
  dayLabel: string;
  dateLabel: string;
};

function BackIcon({ className }: { className?: string }) {
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
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 21s-8-4.5-8-11.8A8 8 0 0 1 12 3a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarDayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function CardPayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M21 8v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
      <path d="M23 8H1V6a2 2 0 0 1 1.7-2l9-1.6a2 2 0 0 1 .6 0l9 1.6A2 2 0 0 1 23 6v2Z" />
    </svg>
  );
}

function TruckSmallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckoutProgress({ step, mode }: { step: CheckoutStep; mode: "configure" | "review" }) {
  const label = step === 1 ? "Step 1/2" : "Step 2/2";
  const right = mode === "configure" ? "Review & place order" : "Final review & place order";
  return (
    <div className="px-4 pb-3 pt-1">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-muted">
        <span className="font-bold text-primary">{label}</span>
        <span>{right}</span>
      </div>
      <div className="flex h-1.5 gap-1">
        <div className={cn("flex-1 rounded-full", step >= 1 ? "bg-primary" : "bg-default")} />
        <div className={cn("flex-1 rounded-full", step >= 2 ? "bg-primary" : "bg-default")} />
      </div>
    </div>
  );
}

function buildDeliveryDateOptions(): DeliveryDateOption[] {
  const out: DeliveryDateOption[] = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  for (let i = 1; i <= 5; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const wd = d.toLocaleDateString("en-US", { weekday: "short" });
    const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    out.push({
      id: d.toISOString().slice(0, 10),
      dayLabel: i === 1 ? "Tomorrow" : wd,
      dateLabel: md,
    });
  }
  return out;
}

export function CheckoutScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const lines = useCartStore((s) => s.lines);
  const clearCart = useCartStore((s) => s.clear);
  const mutation = usePlaceOrderMutation(userId ?? undefined);

  const [step, setStep] = useState<CheckoutStep>(1);
  const [error, setError] = useState<string | null>(null);
  const [addressEditing, setAddressEditing] = useState(false);
  const [businessName, setBusinessName] = useState("Main Restaurant Location");
  const [line1, setLine1] = useState("123 Culinary Blvd, Suite A");
  const [city, setCity] = useState("Austin");
  const [stateRegion, setStateRegion] = useState("TX");
  const [postal, setPostal] = useState("78701");
  const [attention, setAttention] = useState("Receiving Dock");

  const deliveryDatesRef = useRef<DeliveryDateOption[] | null>(null);
  const deliveryDates = useSyncExternalStore(
    () => () => {},
    (): DeliveryDateOption[] | null => {
      if (deliveryDatesRef.current === null) {
        deliveryDatesRef.current = buildDeliveryDateOptions();
      }
      return deliveryDatesRef.current;
    },
    (): DeliveryDateOption[] | null => null,
  );
  const [deliveryDateId, setDeliveryDateId] = useState<string | null>(null);
  const [deliverySlot, setDeliverySlot] = useState<DeliverySlot>("morning");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cod");
  const [upiId, setUpiId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const effectiveDeliveryDateId = deliveryDateId ?? deliveryDates?.[0]?.id ?? null;

  const itemCount = useMemo(() => lines.reduce((n, l) => n + l.quantity, 0), [lines]);
  const subtotalCents = useMemo(() => cartTotalCents(lines), [lines]);
  const estTaxCents = Math.round(subtotalCents * EST_TAX_RATE);
  const totalWithTaxCents = subtotalCents + estTaxCents;

  const selectedDateLabel = useMemo(() => {
    if (!deliveryDates || !effectiveDeliveryDateId) return "—";
    const o = deliveryDates.find((d) => d.id === effectiveDeliveryDateId);
    return o ? `${o.dateLabel} (${o.dayLabel})` : "—";
  }, [deliveryDates, effectiveDeliveryDateId]);

  const slotLabel = deliverySlot === "morning" ? "Morning (8am – 12pm)" : "Afternoon (1pm – 5pm)";

  const uid = userId;

  if (lines.length === 0) {
    return (
      <Card>
        <p className="text-secondary">Your cart is empty.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => router.push("/cart")}>
            View cart
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/")}>
            Continue shopping
          </Button>
        </div>
      </Card>
    );
  }

  function addressValid(): boolean {
    return [businessName, line1, city, stateRegion, postal].every((s) => s.trim().length > 0);
  }

  function goReview() {
    setError(null);
    if (!addressValid()) {
      setError("Please complete all address fields.");
      setAddressEditing(true);
      return;
    }
    setStep(2);
    setTermsAccepted(false);
  }

  async function placeOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted) return;
    setError(null);
    if (!uid) {
      setError("Sign in is required to place an order.");
      return;
    }
    try {
      const order = await mutation.mutateAsync({
        userId: uid,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          title: l.title,
        })),
      });
      clearCart();
      router.push(`/orders/${order.id}/confirmation`);
    } catch (err) {
      setError(domainErrorMessage(err, "Checkout failed"));
    }
  }

  function onHeaderBack() {
    if (step === 2) {
      setStep(1);
      return;
    }
    router.back();
  }

  const headerTitle = step === 1 ? "Checkout" : "Checkout review";

  return (
    <div className="relative -mx-4 flex min-h-[min(85dvh,40rem)] flex-col overflow-hidden rounded-2xl border border-default bg-card shadow-sm sm:mx-0">
      <div className="h-0.5 w-full shrink-0 bg-primary" aria-hidden />

      <div className="sticky top-0 z-20 shrink-0 border-b border-default/60 bg-card/95 backdrop-blur-sm">
        <header className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-heading transition-colors hover:bg-secondary-bg"
            aria-label="Go back"
            onClick={onHeaderBack}
          >
            <BackIcon />
          </button>
          <h1 className="text-sm font-semibold tracking-tight text-heading">{headerTitle}</h1>
          <div className="h-9 w-9 shrink-0" aria-hidden />
        </header>
        <CheckoutProgress step={step} mode={step === 1 ? "configure" : "review"} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(13rem+env(safe-area-inset-bottom))] lg:pb-8">
        {step === 1 ? (
          <>
            <section className="border-b border-default/50 bg-card px-4 py-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-heading">
                <LocationIcon className="text-primary" />
                Delivery address
              </h2>
              {!addressEditing ? (
                <div className="relative rounded-[10px] border border-primary/30 bg-secondary-bg/80 p-3">
                  <div className="absolute right-3 top-3 text-primary" aria-hidden>
                    <CheckIcon className="h-4 w-4" />
                  </div>
                  <h3 className="mb-1 text-xs font-bold text-heading">{businessName}</h3>
                  <p className="text-[11px] leading-relaxed text-secondary">
                    {line1}
                    <br />
                    {city}, {stateRegion} {postal}
                    <br />
                    Attn: {attention}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-[10px] font-semibold text-primary hover:underline"
                    onClick={() => setAddressEditing(true)}
                  >
                    Edit address
                  </button>
                </div>
              ) : (
                <Card className="space-y-3 border-default/80 p-3 shadow-none">
                  <Input label="Business / location name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                  <Input label="Street address" value={line1} onChange={(e) => setLine1(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
                    <Input label="State" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Postal code" value={postal} onChange={(e) => setPostal(e.target.value)} />
                    <Input label="Attention / dock" value={attention} onChange={(e) => setAttention(e.target.value)} />
                  </div>
                  <Button type="button" variant="secondary" fullWidth onClick={() => setAddressEditing(false)}>
                    Save address
                  </Button>
                </Card>
              )}

              <h2 className="mb-3 mt-5 flex items-center gap-2 text-sm font-bold text-heading">
                <CalendarDayIcon className="text-primary" />
                Delivery date &amp; time
              </h2>
              {!deliveryDates ? (
                <p className="text-xs text-muted">Loading delivery options…</p>
              ) : (
                <>
                  <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-2">
                    {deliveryDates.map((d) => {
                      const selected = effectiveDeliveryDateId === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDeliveryDateId(d.id)}
                          className={cn(
                            "flex min-w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-lg border p-2 text-center transition-opacity",
                            selected
                              ? "border-primary bg-primary text-white shadow-sm"
                              : "border-default bg-secondary-bg/80 text-heading opacity-80 hover:opacity-100",
                          )}
                        >
                          <span className="text-[10px] font-medium uppercase">{d.dayLabel}</span>
                          <span className="text-sm font-bold">{d.dateLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliverySlot("morning")}
                      className={cn(
                        "relative rounded-lg border p-2 text-center text-[11px] font-semibold transition-opacity",
                        deliverySlot === "morning"
                          ? "border-primary/40 bg-primary-light text-primary"
                          : "border-default bg-secondary-bg/80 text-heading opacity-80 hover:opacity-100",
                      )}
                    >
                      {deliverySlot === "morning" ? (
                        <CheckIcon className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" />
                      ) : null}
                      Morning (8am – 12pm)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliverySlot("afternoon")}
                      className={cn(
                        "rounded-lg border p-2 text-center text-[11px] font-medium transition-opacity",
                        deliverySlot === "afternoon"
                          ? "border-primary/40 bg-primary-light text-primary"
                          : "border-default bg-secondary-bg/80 text-heading opacity-80 hover:opacity-100",
                      )}
                    >
                      Afternoon (1pm – 5pm)
                    </button>
                  </div>
                </>
              )}
            </section>

            <section className="border-b border-default/50 bg-card px-4 py-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-heading">
                <CardPayIcon className="text-primary" />
                Payment method
              </h2>
              <div className="mb-4 flex flex-col gap-2">
                <label
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-[10px] border p-3",
                    paymentMode === "upi" ? "border-primary/40 bg-primary-light/40" : "border-default bg-secondary-bg/60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        paymentMode === "upi" ? "border-primary" : "border-default",
                      )}
                    >
                      {paymentMode === "upi" ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                    </span>
                    <div>
                      <span className="block text-xs font-bold text-heading">UPI</span>
                      <span className="text-[10px] text-muted">Pay with UPI (demo — not charged)</span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="pay"
                    className="sr-only"
                    checked={paymentMode === "upi"}
                    onChange={() => setPaymentMode("upi")}
                  />
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-[10px] border p-3",
                    paymentMode === "cod" ? "border-primary/40 bg-primary-light/40" : "border-default bg-secondary-bg/60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        paymentMode === "cod" ? "border-primary" : "border-default",
                      )}
                    >
                      {paymentMode === "cod" ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                    </span>
                    <div>
                      <span className="block text-xs font-bold text-heading">Cash on delivery</span>
                      <span className="text-[10px] text-muted">Pay when your order arrives</span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="pay"
                    className="sr-only"
                    checked={paymentMode === "cod"}
                    onChange={() => setPaymentMode("cod")}
                  />
                </label>
              </div>
              {paymentMode === "upi" ? (
                <div className="mb-4">
                  <Input
                    label="UPI ID (optional)"
                    placeholder="you@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              ) : null}
              <div className="mb-4">
                <Input
                  label="Purchase order number (optional)"
                  placeholder="e.g. PO-2023-1024"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />
              </div>
              <label className="flex w-full flex-col gap-1.5 text-sm">
                <span className="font-medium text-heading">Order notes</span>
                <textarea
                  placeholder="Delivery instructions or special requests…"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={4}
                  className="min-h-20 w-full resize-none rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-heading outline-none transition-shadow placeholder:text-input-placeholder focus:border-border-focus focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </section>

            <section className="bg-secondary-bg/80 px-4 py-4">
              <div className="flex items-start gap-2 text-[10px] leading-relaxed text-secondary">
                <ShieldIcon className="mt-0.5 shrink-0 text-primary" />
                <p>
                  By continuing, you agree to our{" "}
                  <Link href="/terms" className="font-medium text-primary underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/about" className="font-medium text-primary underline">
                    return &amp; policy info
                  </Link>
                  . Wholesale orders are subject to availability and final confirmation.
                </p>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="border-b border-default/50 bg-card px-4 py-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-heading">
                  <BoxIcon className="text-primary" />
                  Order items
                </h2>
                <span className="rounded-md bg-primary-light px-2 py-1 text-[11px] font-semibold text-primary">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {lines.map((line) => (
                  <li
                    key={line.productId}
                    className="flex gap-3 rounded-[10px] border border-default/50 bg-secondary-bg/60 p-3"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-default bg-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={line.imageUrl} alt="" className="h-full w-full object-contain" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <h3 className="truncate text-xs font-bold text-heading">{line.title}</h3>
                        <p className="mt-0.5 text-[10px] text-muted">SKU: {line.productId}</p>
                      </div>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="rounded border border-default bg-card px-2 py-0.5 text-xs font-semibold text-heading">
                          Qty: {line.quantity}
                        </span>
                        <span className="text-sm font-bold text-heading">
                          {formatMoney(line.unitPriceCents * line.quantity)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-4 border-b border-default/50 bg-card px-4 py-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold text-heading">
                    <TruckSmallIcon className="text-primary" />
                    Delivery details
                  </h2>
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-primary hover:underline"
                    onClick={() => setStep(1)}
                  >
                    Edit
                  </button>
                </div>
                <div className="rounded-lg border border-default/50 bg-secondary-bg/80 p-3 text-[11px] leading-tight text-heading">
                  <p className="mb-1 font-semibold">{businessName}</p>
                  <p className="text-secondary">
                    {line1}, {city}, {stateRegion} {postal}
                  </p>
                  <div className="mt-2 flex justify-between border-t border-default/50 pt-2">
                    <span className="text-muted">
                      Date: <strong className="text-heading">{selectedDateLabel}</strong>
                    </span>
                    <span className="text-muted">
                      Time: <strong className="text-heading">{slotLabel}</strong>
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold text-heading">
                    <CardPayIcon className="text-primary" />
                    Payment details
                  </h2>
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-primary hover:underline"
                    onClick={() => setStep(1)}
                  >
                    Edit
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-default/50 bg-secondary-bg/80 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-primary-light text-primary">
                      <CardPayIcon className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-heading">
                        {paymentMode === "upi" ? "UPI" : "Cash on delivery"}
                      </p>
                      {paymentMode === "upi" && upiId.trim() ? (
                        <p className="text-[9px] text-muted">VPA: {upiId.trim()}</p>
                      ) : poNumber.trim() ? (
                        <p className="text-[9px] text-muted">PO: {poNumber.trim()}</p>
                      ) : (
                        <p className="text-[9px] text-muted">No PO on file</p>
                      )}
                    </div>
                  </div>
                  <CheckIcon className="h-4 w-4 text-primary" />
                </div>
              </div>
            </section>

            <section className="bg-secondary-bg/80 px-4 py-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-default text-primary focus:ring-primary/30"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span className="text-[11px] leading-relaxed text-muted">
                  <span className="mb-0.5 block font-semibold text-heading">I acknowledge and agree to the terms</span>
                  By placing this order, I agree to the{" "}
                  <Link href="/terms" className="font-medium text-primary hover:underline">
                    wholesale terms of service
                  </Link>{" "}
                  and{" "}
                  <Link href="/about" className="font-medium text-primary hover:underline">
                    return policy information
                  </Link>
                  , and authorize this purchase on behalf of my business.
                </span>
              </label>
            </section>
          </>
        )}
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
          <span className="text-sm font-semibold text-heading">{formatMoney(subtotalCents)}</span>
        </div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">Shipping &amp; delivery</span>
          <span className="text-sm font-semibold text-success">Free</span>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">Est. taxes</span>
          <span className="text-sm font-semibold text-heading">{formatMoney(estTaxCents)}</span>
        </div>
        <div className="mb-4 flex items-center justify-between border-t border-default/40 pt-2">
          <span className="text-sm font-bold text-heading">Total</span>
          <span className="text-xl font-bold text-primary">{formatMoney(totalWithTaxCents)}</span>
        </div>
        {error ? (
          <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        {step === 1 ? (
          <Button
            type="button"
            fullWidth
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] text-sm font-bold shadow-md"
            onClick={goReview}
          >
            Review order
            <ChevronRightIcon />
          </Button>
        ) : (
          <form onSubmit={placeOrderSubmit}>
            <Button
              type="submit"
              fullWidth
              disabled={!termsAccepted || mutation.isPending}
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] text-sm font-bold shadow-md",
                !termsAccepted && "opacity-60",
              )}
            >
              {mutation.isPending ? (
                "Placing order…"
              ) : termsAccepted ? (
                <>
                  <CheckIcon className="h-4 w-4" />
                  Place order
                </>
              ) : (
                <>
                  <LockIcon className="h-3.5 w-3.5 opacity-80" />
                  Place order
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
