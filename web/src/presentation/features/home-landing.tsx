"use client";

import type { Product } from "@domain/product";
import { LinkButton } from "@presentation/components/ui/link-button";
import { useProductsQuery } from "@presentation/hooks/use-products-query";
import { cn } from "@presentation/lib/cn";
import { formatMoney } from "@presentation/lib/format-money";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type TransitionEvent,
} from "react";

const heroHeadline = "PREMIUM DISPOSABLE GOODS, DELIVERED INSTANTLY";

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-primary", className)}
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-primary", className)}
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-primary", className)}
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-primary", className)}
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.18a2 2 0 0 1-1.66 0L2 17.67" />
      <path d="m22 12.65-9.17 4.18a2 2 0 0 1-1.66 0L2 12.67" />
    </svg>
  );
}

const valueBlocks: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}[] = [
  {
    Icon: SparklesIcon,
    title: "Certified wholesale quality",
    sub: "Restaurant-grade disposable lines vetted for strength, safety, and reliable supply.",
  },
  {
    Icon: TruckIcon,
    title: "Rapid replenishment",
    sub: "Streamlined reordering keeps your storeroom stocked without slowing down service.",
  },
  {
    Icon: ShieldIcon,
    title: "Consistent specs",
    sub: "Case counts, materials, and certifications stay documented so deliveries match expectations.",
  },
  {
    Icon: LayersIcon,
    title: "One cart, many aisles",
    sub: "Plates, lids, napkins, cutlery—in one storefront built for disposable purchasing.",
  },
];

const speedPhases = [
  {
    label: "Order placed",
    subtitle: "Your order confirms and allocates inventory instantly.",
  },
  {
    label: "Dispatch",
    subtitle: "Picked, packed, and labeled for same-day cutoff windows.",
  },
  {
    label: "In transit",
    subtitle: "Live routing keeps handoffs predictable for your crews.",
  },
  {
    label: "Delivered",
    subtitle: "Checkpoints close out so reconciliation stays effortless.",
  },
] as const;

const speedPhaseProgress = ["0%", "33.333%", "66.666%", "100%"] as const;

const CAROUSEL_GAP_PX = 16;

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function FeaturedCarouselSkeleton() {
  return (
    <div className="rounded-[1.25rem] border border-default/80 bg-card p-3 shadow-[0_8px_40px_-16px_rgba(15,23,42,0.12)] sm:p-4">
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={String(i)}
            className="aspect-[3/4] animate-pulse rounded-xl bg-secondary-bg"
          />
        ))}
      </div>
    </div>
  );
}

const CAROUSEL_VISIBLE = 4;

function FeaturedCarouselSlide({
  product,
  widthStyle,
}: {
  product: Product;
  widthStyle: CSSProperties;
}) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      style={widthStyle}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-default/70 bg-card shadow-sm ring-1 ring-black/[0.04] transition-[transform,box-shadow] duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="aspect-[4/3] bg-primary-light">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-1 flex-col p-2.5 sm:p-3">
          <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-heading sm:text-sm">
            {product.title}
          </h3>
          <p className="mt-auto pt-1.5 text-xs font-semibold text-primary sm:text-sm">
            {formatMoney(product.priceCents, product.currency)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function FeaturedProductCarousel({ pool }: { pool: Product[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const slideIndexRef = useRef(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const autoplayRef = useRef<number | null>(null);
  const poolLen = pool.length;
  const canNavigate = poolLen > 1;

  useLayoutEffect(() => {
    slideIndexRef.current = slideIndex;
  }, [slideIndex]);

  const strip = useMemo(
    () =>
      Array.from({ length: poolLen + CAROUSEL_VISIBLE }, (_, i) => pool[i % poolLen]),
    [pool, poolLen],
  );

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const gapTotal = CAROUSEL_GAP_PX * (CAROUSEL_VISIBLE - 1);
    const cw = (w - gapTotal) / CAROUSEL_VISIBLE;
    if (cw > 0) setCardWidth(cw);
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const gapRem = CAROUSEL_GAP_PX / 16;
  const step = cardWidth > 0 ? cardWidth + CAROUSEL_GAP_PX : 0;
  const translatePx = -slideIndex * step;

  const advanceNext = useCallback(() => {
    setTransitionEnabled(true);
    setSlideIndex((i) => {
      if (i >= poolLen) return i;
      if (i === poolLen - 1) return poolLen;
      return i + 1;
    });
  }, [poolLen]);

  const bumpAutoplay = useCallback(() => {
    if (autoplayRef.current) window.clearInterval(autoplayRef.current);
    if (poolLen <= CAROUSEL_VISIBLE) return;
    autoplayRef.current = window.setInterval(advanceNext, 4200);
  }, [advanceNext, poolLen]);

  useEffect(() => {
    bumpAutoplay();
    return () => {
      if (autoplayRef.current) window.clearInterval(autoplayRef.current);
    };
  }, [bumpAutoplay]);

  const goNext = useCallback(() => {
    if (!canNavigate) return;
    advanceNext();
    bumpAutoplay();
  }, [canNavigate, advanceNext, bumpAutoplay]);

  const goPrev = useCallback(() => {
    if (!canNavigate) return;
    bumpAutoplay();
    if (slideIndexRef.current === 0) {
      setTransitionEnabled(false);
      setSlideIndex(poolLen);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionEnabled(true);
          setSlideIndex(poolLen - 1);
        });
      });
      return;
    }
    setTransitionEnabled(true);
    setSlideIndex((i) => i - 1);
  }, [bumpAutoplay, poolLen, canNavigate]);

  const onTrackTransitionEnd = useCallback((e: TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "transform") return;
    if (slideIndexRef.current !== poolLen) return;
    setTransitionEnabled(false);
    setSlideIndex(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTransitionEnabled(true));
    });
  }, [poolLen]);

  const activeDot = slideIndex >= poolLen ? 0 : slideIndex % poolLen;

  const widthStyle: CSSProperties =
    cardWidth > 0
      ? { width: cardWidth }
      : {
          width: `calc((100% - ${gapRem * (CAROUSEL_VISIBLE - 1)}rem) / ${CAROUSEL_VISIBLE})`,
        };

  return (
    <div className="relative px-10 sm:px-11 md:px-12 lg:px-14">
      <div
        className="rounded-[1.25rem] border border-default/80 bg-card p-3 shadow-[0_8px_40px_-16px_rgba(15,23,42,0.12)] sm:p-4"
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured products"
      >
        <div className="relative">
          {canNavigate ? (
            <>
              <button
                type="button"
                aria-label="Previous featured products"
                onClick={goPrev}
                className="absolute -left-1 top-1/2 z-[2] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-default/80 bg-card text-heading shadow-lg shadow-black/10 ring-1 ring-black/[0.04] backdrop-blur-sm transition-[colors,transform] hover:scale-105 hover:bg-primary-light/90 sm:-left-0.5"
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                aria-label="Next featured products"
                onClick={goNext}
                className="absolute -right-1 top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-default/80 bg-card text-heading shadow-lg shadow-black/10 ring-1 ring-black/[0.04] backdrop-blur-sm transition-[colors,transform] hover:scale-105 hover:bg-primary-light/90 sm:-right-0.5"
              >
                <ChevronRightIcon />
              </button>
            </>
          ) : null}

          <div ref={viewportRef} className="overflow-hidden rounded-xl">
            <div
              className={cn(
                "flex",
                transitionEnabled &&
                  "motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-reduce:transition-none",
              )}
              style={{
                gap: CAROUSEL_GAP_PX,
                transform:
                  step > 0 ? `translate3d(${translatePx}px,0,0)` : "translate3d(0,0,0)",
              }}
              onTransitionEnd={onTrackTransitionEnd}
            >
              {strip.map((product, idx) => (
                <FeaturedCarouselSlide
                  key={`${product.id}-${idx}`}
                  product={product}
                  widthStyle={widthStyle}
                />
              ))}
            </div>
          </div>
        </div>

        {canNavigate ? (
          <div
            className="mt-4 flex justify-center gap-2"
            role="tablist"
            aria-label="Featured slides"
          >
            {Array.from({ length: poolLen }).map((_, i) => (
              <button
                key={String(i)}
                type="button"
                role="tab"
                aria-selected={i === activeDot}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => {
                  setTransitionEnabled(true);
                  setSlideIndex(i);
                  bumpAutoplay();
                }}
                className={cn(
                  "h-2 rounded-full transition-[width,background-color] duration-300",
                  i === activeDot
                    ? "w-6 bg-primary"
                    : "w-2 bg-default hover:bg-secondary",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SpeedNetworkAnimation() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 right-0 top-4 h-14"
    >
      <div className="absolute left-[12.5%] right-[12.5%] top-0 h-full">
        <div className="absolute inset-x-0 top-5 h-2 overflow-hidden rounded-full bg-default/70 shadow-inner ring-1 ring-white/70">
          <div className="speed-network-road-shine absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-80" />
          <div className="speed-network-progress absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/85 via-primary to-catalog-blue/80 shadow-[0_0_18px_rgba(31,122,99,0.35)]" />
        </div>

        {speedPhaseProgress.map((position, i) => (
          <span
            key={position}
            className="speed-network-check absolute top-4 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-card bg-primary shadow-[0_0_0_8px_rgba(31,122,99,0.08)]"
            style={
              {
                "--checkpoint-delay": `${0.15 + i * 1.2}s`,
                left: position,
              } as CSSProperties
            }
          />
        ))}

        <div className="speed-network-truck absolute left-0 top-0 z-[1] -translate-x-1/2">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-card text-primary shadow-[0_16px_34px_-14px_rgba(15,23,42,0.48)] ring-1 ring-white/90">
            <span className="absolute -right-8 top-1/2 h-px w-8 -translate-y-1/2 bg-gradient-to-r from-primary/45 to-transparent" />
            <TruckIcon className="h-7 w-7" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeLanding() {
  // const { data: products = [], error, isPending, isSuccess } = useProductsQuery();
  const speedNetworkRef = useRef<HTMLElement>(null);
  const [speedNetworkActive, setSpeedNetworkActive] = useState(false);

  // const featuredPool = useMemo(() => {
  //   if (!products.length) return [];
  //   const out: Product[] = [];
  //   while (out.length < 8) {
  //     out.push(...products);
  //   }
  //   return out.slice(0, Math.max(products.length, 8));
  // }, [products]);

  useEffect(() => {
    if (speedNetworkActive) return;
    const node = speedNetworkRef.current;
    if (!node) return;

    if (typeof window.IntersectionObserver === "undefined") {
      const fallbackTimer = window.setTimeout(() => setSpeedNetworkActive(true), 0);
      return () => window.clearTimeout(fallbackTimer);
    }

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSpeedNetworkActive(true);
        observer.disconnect();
      },
      {
        rootMargin: "0px 0px -18% 0px",
        threshold: 0.35,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [speedNetworkActive]);

  return (
    <div className="flex flex-col gap-14 pb-10 lg:gap-20 lg:pb-14">
      <section
        aria-label="Featured introduction"
        className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12"
      >
        <div className="flex min-w-0 flex-col gap-5 text-left">
          <p className="text-3xl font-extrabold uppercase leading-[1.1] tracking-tight text-heading sm:text-4xl lg:text-[2.6rem]">
            {heroHeadline}
          </p>
          <p className="max-w-xl text-base text-secondary sm:text-lg">
            Stock up on plates, cutlery, drinkware, and packaging from a single catalog—made for
            teams that need trusted quality on every delivery.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/catalog" variant="primary">
              Browse Catalog
            </LinkButton>
            <LinkButton href="/cart" variant="secondary">
              Order Now
            </LinkButton>
          </div>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-default bg-primary-light shadow-lg lg:aspect-square lg:max-h-[min(28rem,50vh)]">
          <Image
            src="/placeholder-product.svg"
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority
          />
        </div>
      </section>

      <section aria-label="Why Grove" className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {valueBlocks.map(({ Icon, title, sub }) => (
            <div
              key={title}
              className="flex flex-col items-start gap-3 border-b border-default pb-6 last:border-b-0 sm:border-b-0 sm:pb-0 lg:border-b-0"
            >
              <Icon className="shrink-0" />
              <h2 className="text-lg font-bold text-heading">{title}</h2>
              <p className="text-sm leading-relaxed text-secondary">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* <section aria-label="Featured items" className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold text-heading">Featured items</h2>
          <p className="mt-1 text-sm text-secondary">Rotating picks from the catalog.</p>
        </div>
        {isPending ? (
          <FeaturedCarouselSkeleton />
        ) : isSuccess && featuredPool.length ? (
          <FeaturedProductCarousel pool={featuredPool} />
        ) : null}
      </section> */}

      <section
        ref={speedNetworkRef}
        aria-label="Fulfillment checkpoints"
        className="flex flex-col gap-8"
      >
        <div>
          <h2 className="text-2xl font-bold text-heading">Speed Network</h2>
          <p className="mt-1 text-sm text-secondary">
            Four checkpoints so every box moves faster from click to countertop.
          </p>
        </div>
        <div
          className={cn(
            "relative overflow-hidden rounded-[1.25rem] border border-default/80 bg-card p-4 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)] sm:p-5 lg:p-6",
            speedNetworkActive && "speed-network-is-active",
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(31,122,99,0.08),transparent_34%,rgba(5,44,101,0.05))]" />
          <SpeedNetworkAnimation />
          <div className="relative grid gap-5 pt-20 sm:gap-6 lg:grid-cols-4 lg:gap-4">
            {speedPhases.map(({ label, subtitle }, i) => (
              <div
                key={label}
                className="speed-network-phase group relative flex min-h-[8.75rem] gap-4 rounded-xl border border-default/70 bg-card/90 p-4 text-left shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-md lg:flex-col lg:gap-4"
                style={
                  {
                    "--phase-delay": `${i * 0.12}s`,
                    "--badge-delay": `${0.55 + i * 1.2}s`,
                  } as CSSProperties
                }
              >
                <div className="absolute inset-x-4 top-0 hidden h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent lg:block" />
                <div className="flex items-start gap-3 lg:flex-col lg:items-start">
                  <div className="speed-network-phase-badge flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary ring-4 ring-card transition-colors group-hover:bg-primary group-hover:text-card">
                    {i + 1}
                  </div>
                  <div className="min-h-px flex-1 border-t border-dashed border-default lg:hidden" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-heading">{label}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-secondary">{subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
