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

export function HomeLanding() {
  const { data: products = [], isPending, isSuccess } = useProductsQuery();

  const featuredPool = useMemo(() => {
    if (!products.length) return [];
    const out: Product[] = [];
    while (out.length < 8) {
      out.push(...products);
    }
    return out.slice(0, Math.max(products.length, 8));
  }, [products]);

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

      <section aria-label="Featured items" className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold text-heading">Featured items</h2>
          <p className="mt-1 text-sm text-secondary">Rotating picks from the catalog.</p>
        </div>
        {isPending ? (
          <FeaturedCarouselSkeleton />
        ) : isSuccess && featuredPool.length ? (
          <FeaturedProductCarousel pool={featuredPool} />
        ) : null}
      </section>

      <section aria-label="Fulfillment checkpoints" className="flex flex-col gap-8">
        <div>
          <h2 className="text-2xl font-bold text-heading">Speed Network</h2>
          <p className="mt-1 text-sm text-secondary">
            Four checkpoints so every box moves faster from click to countertop.
          </p>
        </div>
        <div className="relative">
          <div
            aria-hidden
            className="absolute left-6 right-6 top-[18px] hidden h-px bg-default lg:block"
            style={{
              maskImage:
                "linear-gradient(90deg, transparent 12px, black 36px, black calc(100% - 36px), transparent calc(100% - 12px))",
            }}
          />
          <div className="relative grid gap-8 sm:gap-10 lg:grid-cols-4 lg:gap-4">
            {speedPhases.map(({ label, subtitle }, i) => (
              <div key={label} className="flex flex-col gap-3 text-left lg:items-start lg:gap-4">
                <div className="flex items-start gap-3 lg:flex-col lg:items-start">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary ring-4 ring-card">
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
