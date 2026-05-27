"use client";

import type { UserAddress } from "@application/ports/user-profile-gateway";
import { cartTotalCents } from "@domain/cart";
import { DomainError } from "@domain/errors";
import { MobilePageHeader } from "@presentation/components/shop/mobile-page-header";
import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { usePlaceOrderMutation } from "@presentation/hooks/use-place-order-mutation";
import { cn } from "@presentation/lib/cn";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import { formatMoney } from "@presentation/lib/format-money";
import { queryKeys } from "@presentation/query-keys";
import { useAuthStore } from "@presentation/state/auth-store";
import { useCartStore } from "@presentation/state/cart-store";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const EMPTY_ADDRESSES: UserAddress[] = [];
function positiveEnvNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PARTIAL_PAYMENT_THRESHOLD_CENTS =
  positiveEnvNumber(
    process.env.NEXT_PUBLIC_PARTIAL_PAYMENT_THRESHOLD_INR,
    5000,
  ) * 100;
const PARTIAL_PAYMENT_PERCENT = positiveEnvNumber(
  process.env.NEXT_PUBLIC_PARTIAL_PAYMENT_PERCENT,
  20,
);

type CheckoutStep = 1 | 2;
type PaymentOption = "FULL_UPI" | "PARTIAL_UPI";

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  method?: Record<string, boolean>;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
      on: (
        event: "payment.failed",
        handler: (response: {
          error?: {
            code?: string;
            description?: string;
            metadata?: {
              order_id?: string;
              payment_id?: string;
            };
          };
        }) => void,
      ) => void;
    };
  }
}

function LocationIcon({ className }: { className?: string }) {
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
      <path d="M12 21s-8-4.5-8-11.8A8 8 0 0 1 12 3a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CardPayIcon({ className }: { className?: string }) {
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
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
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

function BoxIcon({ className }: { className?: string }) {
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
      <path d="M21 8v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
      <path d="M23 8H1V6a2 2 0 0 1 1.7-2l9-1.6a2 2 0 0 1 .6 0l9 1.6A2 2 0 0 1 23 6v2Z" />
    </svg>
  );
}

function TruckSmallIcon({ className }: { className?: string }) {
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
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
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
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/**
 * Inline spinner used during the place-order request so the buyer sees the
 * checkout is in flight instead of a frozen button. CSS-only animation
 * (motion-reduce safe) so it stays smooth across mobile/tablet/desktop.
 */
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn(
        "h-4 w-4 animate-spin motion-reduce:animate-none",
        className,
      )}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckoutProgress({
  step,
  mode,
}: {
  step: CheckoutStep;
  mode: "configure" | "review";
}) {
  const label = step === 1 ? "Step 1/2" : "Step 2/2";
  const right =
    mode === "configure"
      ? "Review & place order"
      : "Final review & place order";
  return (
    <div className="px-4 pb-3 pt-1">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-muted">
        <span className="font-bold text-primary">{label}</span>
        <span>{right}</span>
      </div>
      <div className="flex h-1.5 gap-1">
        <div
          className={cn(
            "flex-1 rounded-full",
            step >= 1 ? "bg-primary" : "bg-default",
          )}
        />
        <div
          className={cn(
            "flex-1 rounded-full",
            step >= 2 ? "bg-primary" : "bg-default",
          )}
        />
      </div>
    </div>
  );
}

function formatAddressLine(address: UserAddress): string {
  return `${address.city}, ${address.state} ${address.pincode}`;
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load UPI checkout")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load UPI checkout"));
    document.body.appendChild(script);
  });
}

export function CheckoutScreen() {
  const router = useRouter();
  const deps = useAppDependencies();
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession);
  const lines = useCartStore((s) => s.lines);
  const clearCart = useCartStore((s) => s.clear);
  const mutation = usePlaceOrderMutation(userId ?? undefined);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CheckoutStep>(1);
  const [error, setError] = useState<string | null>(null);
  /** True when the last failure was a stock conflict, so we render an extra
   *  "Refresh products" hint and (already) auto-refetched the catalog. */
  const [conflictDetected, setConflictDetected] = useState(false);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("FULL_UPI");
  const [orderNotes, setOrderNotes] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const itemCount = useMemo(
    () => lines.reduce((n, l) => n + l.quantity, 0),
    [lines],
  );
  const cartCurrency = lines[0]?.currency ?? "USD";
  const subtotalCents = useMemo(() => cartTotalCents(lines), [lines]);
  const totalCents = subtotalCents;
  const partialEligible = totalCents > PARTIAL_PAYMENT_THRESHOLD_CENTS;
  const effectivePaymentOption: PaymentOption = partialEligible
    ? paymentOption
    : "FULL_UPI";
  const partialNowCents = Math.ceil(
    (totalCents * PARTIAL_PAYMENT_PERCENT) / 100,
  );
  const payNowCents =
    effectivePaymentOption === "PARTIAL_UPI" ? partialNowCents : totalCents;
  const deliveryDueCents = Math.max(0, totalCents - payNowCents);

  useEffect(() => {
    if (!hasCheckedSession || !isAuthenticated) return;

    let cancelled = false;

    async function loadAddresses() {
      setAddressesLoading(true);
      setAddressesError(null);
      try {
        const profile = await deps.userProfileGateway.getProfile(accessToken);
        if (cancelled) return;
        const nextAddresses = profile.addresses ?? [];
        setAddresses(nextAddresses);
        setSelectedAddressId((current) => {
          if (
            current &&
            nextAddresses.some((address) => address.id === current)
          ) {
            return current;
          }
          return (
            nextAddresses.find((address) => address.isDefault)?.id ??
            nextAddresses[0]?.id ??
            null
          );
        });
      } catch (err) {
        if (cancelled) return;
        setAddresses([]);
        setSelectedAddressId(null);
        setAddressesError(
          domainErrorMessage(err, "Could not load saved addresses"),
        );
      } finally {
        if (!cancelled) {
          setAddressesLoading(false);
        }
      }
    }

    void loadAddresses();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    deps.userProfileGateway,
    hasCheckedSession,
    isAuthenticated,
  ]);

  const checkoutAddresses = isAuthenticated ? addresses : EMPTY_ADDRESSES;
  const checkoutAddressesLoading = isAuthenticated && addressesLoading;
  const checkoutAddressesError = isAuthenticated ? addressesError : null;

  const selectedAddress = useMemo(
    () =>
      checkoutAddresses.find((address) => address.id === selectedAddressId) ??
      null,
    [checkoutAddresses, selectedAddressId],
  );

  const uid = userId;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <MobilePageHeader title="Checkout" fallbackHref="/cart" />
        <Card>
          <p className="text-secondary">Your cart is empty.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/cart")}
            >
              View cart
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/")}
            >
              Continue shopping
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  function addressValid(): boolean {
    return Boolean(selectedAddress);
  }

  function goReview() {
    setError(null);
    if (!isAuthenticated) {
      setError("Sign in is required to place an order.");
      return;
    }
    if (checkoutAddressesLoading) {
      setError("Loading your saved addresses. Please wait a moment.");
      return;
    }
    if (!addressValid()) {
      setError(
        checkoutAddresses.length > 0
          ? "Choose a saved delivery address."
          : "Add a saved address from Account before checkout.",
      );
      return;
    }
    setStep(2);
    setTermsAccepted(false);
  }

  async function placeOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted) return;
    setError(null);
    setConflictDetected(false);
    if (!uid) {
      setError("Sign in is required to place an order.");
      return;
    }
    if (!selectedAddress) {
      setError("Choose a saved delivery address before placing the order.");
      setStep(1);
      return;
    }
    if (effectivePaymentOption === "PARTIAL_UPI" && !partialEligible) {
      setError("Partial payment is available only for orders above ₹5,000.");
      setStep(1);
      return;
    }
    try {
      const result = await mutation.mutateAsync({
        userId: uid,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          title: l.title,
        })),
        addressId: selectedAddress.id,
        deliveryType: "STANDARD",
        paymentOption: effectivePaymentOption,
        orderNotes: orderNotes.trim() || undefined,
      });
      const order = await completeUpiPayment(result);
      clearCart();
      router.push(`/orders/${order.id}/confirmation`);
    } catch (err) {
      // CONFLICT means another buyer drained a batch between our quote and
      // our place. We surface a friendly message AND refetch the product
      // catalogue so the cart/catalog "out of stock" chips update.
      if (err instanceof DomainError && err.code === "CONFLICT") {
        setConflictDetected(true);
        setError(
          err.message ||
            "Stock changed while you were checking out. Please review your cart and try again.",
        );
        void queryClient.invalidateQueries({
          queryKey: queryKeys.products(uid),
        });
        // Walk users back to the cart review step so they see the refreshed
        // stock state before re-attempting checkout.
        setStep(1);
        setTermsAccepted(false);
        return;
      }
      setError(domainErrorMessage(err, "Checkout failed"));
    }
  }

  async function completeUpiPayment(
    result: Awaited<ReturnType<typeof mutation.mutateAsync>>,
  ) {
    const payment = result.payment;
    if (payment.demo) {
      return deps.orderWriter.verifyOrderPayment({
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: `pay_demo_${result.order.id}`,
        razorpaySignature: "demo",
      });
    }
    await loadRazorpayScript();
    if (!window.Razorpay) {
      throw new Error("UPI checkout could not be started.");
    }
    const Razorpay = window.Razorpay;
    return new Promise<typeof result.order>((resolve, reject) => {
      const razorpay = new Razorpay({
        key: payment.keyId,
        amount: payment.amountPaise,
        currency: payment.currency,
        name: payment.name,
        description: payment.description,
        order_id: payment.razorpayOrderId,
        method: {
          upi: true,
          card: false,
          netbanking: false,
          wallet: false,
          paylater: false,
        },
        theme: { color: "#1F7A63" },
        modal: {
          ondismiss: () => {
            void deps.orderWriter.markOrderPaymentFailed({
              razorpayOrderId: payment.razorpayOrderId,
              errorCode: "CHECKOUT_CANCELLED",
              errorDescription: "UPI payment was cancelled.",
            });
            reject(new Error("UPI payment was cancelled."));
          },
        },
        handler: (response) => {
          deps.orderWriter
            .verifyOrderPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            .then(resolve)
            .catch(reject);
        },
      });
      razorpay.on("payment.failed", (response) => {
        void deps.orderWriter.markOrderPaymentFailed({
          razorpayOrderId:
            response.error?.metadata?.order_id ?? payment.razorpayOrderId,
          razorpayPaymentId: response.error?.metadata?.payment_id,
          errorCode: response.error?.code,
          errorDescription: response.error?.description,
        });
        reject(new Error(response.error?.description ?? "UPI payment failed."));
      });
      razorpay.open();
    });
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
      <MobilePageHeader
        title={headerTitle}
        onBack={onHeaderBack}
        className="px-4"
        containerClassName="mx-0 shrink-0 border-b border-default/60 bg-page px-0 py-3"
        rightAction={<span className="h-10 w-10 shrink-0" aria-hidden />}
      >
        <CheckoutProgress
          step={step}
          mode={step === 1 ? "configure" : "review"}
        />
      </MobilePageHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(13rem+env(safe-area-inset-bottom))] lg:pb-8">
        {step === 1 ? (
          <>
            <section className="border-b border-default/50 bg-card px-4 py-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-heading">
                <LocationIcon className="text-primary" />
                Delivery address
              </h2>
              {checkoutAddressesLoading ? (
                <div className="rounded-[10px] border border-default bg-secondary-bg/70 p-3">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-default" />
                  <div className="mt-3 h-2.5 w-full animate-pulse rounded-full bg-default" />
                  <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded-full bg-default" />
                </div>
              ) : checkoutAddresses.length > 0 ? (
                <div className="space-y-2">
                  {checkoutAddresses.map((address) => {
                    const selected = address.id === selectedAddressId;
                    return (
                      <button
                        key={address.id}
                        type="button"
                        className={cn(
                          "group w-full rounded-[10px] border p-3 text-left transition-colors",
                          selected
                            ? "border-primary/40 bg-primary-light/45 shadow-sm"
                            : "border-default bg-secondary-bg/70 hover:border-primary/25 hover:bg-secondary-bg",
                        )}
                        onClick={() => setSelectedAddressId(address.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <h3 className="text-xs font-bold text-heading">
                                {address.isDefault
                                  ? "Default delivery address"
                                  : "Saved delivery address"}
                              </h3>
                              {address.isDefault ? (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                  Default
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] leading-relaxed text-secondary">
                              {address.line1}
                              {address.line2 ? (
                                <>
                                  <br />
                                  {address.line2}
                                </>
                              ) : null}
                              <br />
                              {formatAddressLine(address)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              selected
                                ? "border-primary bg-primary text-white"
                                : "border-default bg-card text-transparent group-hover:border-primary/40",
                            )}
                            aria-hidden
                          >
                            <CheckIcon className="h-3 w-3" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  <p className="pt-1 text-[10px] leading-relaxed text-muted">
                    Billing and shipping will use the selected saved address.
                    Addresses are managed from your account.
                  </p>
                </div>
              ) : (
                <div className="rounded-[10px] border border-dashed border-primary/30 bg-primary-light/25 p-3">
                  <h3 className="text-xs font-bold text-heading">
                    No saved delivery address
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-secondary">
                    Add an address in your account first. Checkout will use a
                    saved address only, so billing and shipping stay accurate.
                  </p>
                  <Link
                    href="/account"
                    className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
                  >
                    Add address
                  </Link>
                </div>
              )}
              {checkoutAddressesError ? (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  {checkoutAddressesError}
                </p>
              ) : null}
            </section>

            <section className="border-b border-default/50 bg-card px-4 py-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-heading">
                <CardPayIcon className="text-primary" />
                UPI payment
              </h2>
              <div className="mb-4 rounded-[10px] border border-primary/20 bg-primary-light/30 p-3">
                <p className="text-xs font-bold text-heading">
                  Secure Razorpay UPI checkout
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-secondary">
                  Pay by any UPI app. Card, wallet, net banking, and cash
                  checkout options are disabled for a faster order flow.
                </p>
              </div>
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentOption("FULL_UPI")}
                  className={cn(
                    "flex min-h-24 flex-col justify-between rounded-[10px] border p-3 text-left transition-colors",
                    effectivePaymentOption === "FULL_UPI"
                      ? "border-primary bg-primary-light/50 shadow-sm"
                      : "border-default bg-secondary-bg/70 hover:border-primary/30",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-heading">
                      Pay full via UPI
                    </span>
                    {effectivePaymentOption === "FULL_UPI" ? (
                      <CheckIcon className="text-primary" />
                    ) : null}
                  </span>
                  <span className="mt-3 text-lg font-black text-primary">
                    {formatMoney(totalCents, cartCurrency)}
                  </span>
                  <span className="text-[10px] text-muted">
                    No payment due at delivery
                  </span>
                </button>
                {partialEligible ? (
                  <button
                    type="button"
                    onClick={() => setPaymentOption("PARTIAL_UPI")}
                    className={cn(
                      "flex min-h-24 flex-col justify-between rounded-[10px] border p-3 text-left transition-colors",
                      effectivePaymentOption === "PARTIAL_UPI"
                        ? "border-primary bg-primary-light/50 shadow-sm"
                        : "border-default bg-secondary-bg/70 hover:border-primary/30",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black text-heading">
                        Pay partial now
                      </span>
                      {effectivePaymentOption === "PARTIAL_UPI" ? (
                        <CheckIcon className="text-primary" />
                      ) : null}
                    </span>
                    <span className="mt-3 text-lg font-black text-primary">
                      {formatMoney(partialNowCents, cartCurrency)}
                    </span>
                    <span className="text-[10px] text-muted">
                      {PARTIAL_PAYMENT_PERCENT}% now,{" "}
                      {formatMoney(totalCents - partialNowCents, cartCurrency)}{" "}
                      at delivery
                    </span>
                  </button>
                ) : (
                  <div className="rounded-[10px] border border-dashed border-default bg-secondary-bg/60 p-3 text-[11px] leading-relaxed text-secondary">
                    Partial payment becomes available above{" "}
                    {formatMoney(PARTIAL_PAYMENT_THRESHOLD_CENTS, cartCurrency)}
                    . This order is UPI full payment only.
                  </div>
                )}
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-[10px] border border-default/70 bg-secondary-bg/70 p-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    Pay now
                  </p>
                  <p className="mt-1 text-sm font-black text-heading">
                    {formatMoney(payNowCents, cartCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    Due at delivery
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-black",
                      deliveryDueCents > 0 ? "text-amber-700" : "text-success",
                    )}
                  >
                    {formatMoney(deliveryDueCents, cartCurrency)}
                  </p>
                </div>
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
                  <Link
                    href="/terms"
                    className="font-medium text-primary underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/about"
                    className="font-medium text-primary underline"
                  >
                    return &amp; policy info
                  </Link>
                  . Wholesale orders are subject to availability and final
                  confirmation.
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
                      <img
                        src={line.imageUrl}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <h3 className="truncate text-xs font-bold text-heading">
                          {line.title}
                        </h3>
                        <p className="mt-0.5 text-[10px] text-muted">
                          SKU: {line.productId}
                        </p>
                      </div>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="rounded border border-default bg-card px-2 py-0.5 text-xs font-semibold text-heading">
                          Qty: {line.quantity}
                        </span>
                        <span className="text-sm font-bold text-heading">
                          {formatMoney(
                            line.unitPriceCents * line.quantity,
                            line.currency,
                          )}
                        </span>
                      </div>
                      {line.pricingSource === "SPECIAL" ? (
                        <div className="mt-1 flex items-center justify-between">
                          <span className="rounded bg-primary-light px-1.5 py-0.5 text-[9px] font-bold text-primary">
                            {line.specialPricingLabel ??
                              "Special price for you"}
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
                    Change
                  </button>
                </div>
                <div className="rounded-lg border border-default/50 bg-secondary-bg/80 p-3 text-[11px] leading-tight text-heading">
                  <p className="mb-1 font-semibold">
                    {selectedAddress?.isDefault
                      ? "Default delivery address"
                      : "Selected delivery address"}
                  </p>
                  {selectedAddress ? (
                    <p className="text-secondary">
                      {selectedAddress.line1}
                      {selectedAddress.line2
                        ? `, ${selectedAddress.line2}`
                        : ""}
                      , {formatAddressLine(selectedAddress)}
                    </p>
                  ) : (
                    <p className="text-secondary">No address selected</p>
                  )}
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
                        {effectivePaymentOption === "PARTIAL_UPI"
                          ? "Partial UPI payment"
                          : "Full UPI payment"}
                      </p>
                      <p className="text-[9px] text-muted">
                        Pay now {formatMoney(payNowCents, cartCurrency)}
                        {deliveryDueCents > 0
                          ? ` · Collect ${formatMoney(
                              deliveryDueCents,
                              cartCurrency,
                            )} at delivery`
                          : " · Nothing due at delivery"}
                      </p>
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
                  <span className="mb-0.5 block font-semibold text-heading">
                    I acknowledge and agree to the terms
                  </span>
                  By placing this order, I agree to the{" "}
                  <Link
                    href="/terms"
                    className="font-medium text-primary hover:underline"
                  >
                    wholesale terms of service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/about"
                    className="font-medium text-primary hover:underline"
                  >
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
          <span className="text-sm font-semibold text-heading">
            {formatMoney(subtotalCents, cartCurrency)}
          </span>
        </div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">
            Shipping &amp; delivery
          </span>
          <span className="text-sm font-semibold text-success">Free</span>
        </div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">Pay now</span>
          <span className="text-sm font-semibold text-heading">
            {formatMoney(payNowCents, cartCurrency)}
          </span>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">
            Due at delivery
          </span>
          <span
            className={cn(
              "text-sm font-semibold",
              deliveryDueCents > 0 ? "text-amber-700" : "text-success",
            )}
          >
            {deliveryDueCents > 0
              ? formatMoney(deliveryDueCents, cartCurrency)
              : "None"}
          </span>
        </div>
        <div className="mb-4 flex items-center justify-between border-t border-default/40 pt-2">
          <span className="text-sm font-bold text-heading">Total</span>
          <span className="text-xl font-bold text-primary">
            {formatMoney(totalCents, cartCurrency)}
          </span>
        </div>
        {error ? (
          conflictDetected ? (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs leading-relaxed text-amber-900"
            >
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold">
                !
              </span>
              <div>
                <p className="font-bold">Stock changed during checkout</p>
                <p>{error}</p>
                <p className="mt-1 text-[11px] text-amber-800">
                  We refreshed the latest stock. Update your cart and try
                  again.
                </p>
              </div>
            </div>
          ) : (
            <p
              className="mb-3 text-center text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </p>
          )
        ) : null}
        {step === 1 ? (
          <Button
            type="button"
            fullWidth
            disabled={checkoutAddressesLoading || mutation.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] text-sm font-bold shadow-md"
            onClick={goReview}
          >
            {mutation.isPending ? (
              <>
                <SpinnerIcon className="h-4 w-4" />
                <span>Confirming your order…</span>
              </>
            ) : (
              <>
                Review order
                <ChevronRightIcon />
              </>
            )}
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
                <>
                  <SpinnerIcon className="h-4 w-4" />
                  <span aria-live="polite">Confirming your order…</span>
                </>
              ) : termsAccepted ? (
                <>
                  <CheckIcon className="h-4 w-4" />
                  Pay {formatMoney(payNowCents, cartCurrency)} via UPI
                </>
              ) : (
                <>
                  <LockIcon className="h-3.5 w-3.5 opacity-80" />
                  Pay via UPI
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
