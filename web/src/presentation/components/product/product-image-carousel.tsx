"use client";

import { cn } from "@presentation/lib/cn";
import type { ReactNode } from "react";
import { useState } from "react";

type CategoryPosition = "left" | "right";

type ProductImageCarouselProps = {
  imageUrls: string[];
  categoryLabel?: string;
  categoryPosition?: CategoryPosition;
  emptyLabel?: string;
  className?: string;
  imageClassName?: string;
  topLeft?: ReactNode;
  topLeftClassName?: string;
  topRight?: ReactNode;
  topRightClassName?: string;
  centerOverlay?: ReactNode;
};

function cssImageUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

export function ProductImageCarousel({
  imageUrls,
  categoryLabel,
  categoryPosition = "left",
  emptyLabel = "No image",
  className,
  imageClassName,
  topLeft,
  topLeftClassName,
  topRight,
  topRightClassName,
  centerOverlay,
}: ProductImageCarouselProps) {
  const cleanedImageUrls = imageUrls.filter(Boolean);
  const [imageIndex, setImageIndex] = useState(0);
  const safeImageIndex = imageIndex < cleanedImageUrls.length ? imageIndex : 0;
  const imageUrl = cleanedImageUrls[safeImageIndex];

  function moveImage(e: React.MouseEvent, direction: -1 | 1) {
    e.preventDefault();
    e.stopPropagation();
    if (cleanedImageUrls.length <= 1) return;
    setImageIndex(
      (current) =>
        (current + direction + cleanedImageUrls.length) %
        cleanedImageUrls.length,
    );
  }

  function showImage(e: React.MouseEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    setImageIndex(index);
  }

  return (
    <div
      className={cn(
        "relative h-56 overflow-hidden bg-catalog-surface",
        className,
      )}
    >
      {imageUrl ? (
        <div
          aria-hidden
          className={cn(
            "h-full w-full bg-contain bg-center bg-no-repeat transition-transform duration-300 group-hover:scale-[1.03]",
            imageClassName,
          )}
          style={{ backgroundImage: cssImageUrl(imageUrl) }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold uppercase text-catalog-text-muted">
          {emptyLabel}
        </div>
      )}

      {categoryLabel ? (
        <span
          className={cn(
            "absolute top-3 z-10 max-w-[70%] truncate rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-catalog-green shadow-sm backdrop-blur",
            categoryPosition === "right" ? "right-3" : "left-3",
          )}
        >
          {categoryLabel}
        </span>
      ) : null}

      {topLeft ? (
        <div className={cn("absolute left-3 top-3 z-20", topLeftClassName)}>
          {topLeft}
        </div>
      ) : null}

      {topRight ? (
        <div className={cn("absolute right-3 top-3 z-20", topRightClassName)}>
          {topRight}
        </div>
      ) : null}

      {centerOverlay}

      {cleanedImageUrls.length > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-catalog-text opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100"
            aria-label="Previous image"
            onClick={(e) => moveImage(e, -1)}
          >
            <CarouselArrowIcon className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-catalog-text opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100"
            aria-label="Next image"
            onClick={(e) => moveImage(e, 1)}
          >
            <CarouselArrowIcon className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5">
            {cleanedImageUrls.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === safeImageIndex
                    ? "w-5 bg-catalog-green"
                    : "w-1.5 bg-white/80",
                )}
                aria-label={`Show image ${index + 1}`}
                onClick={(e) => showImage(e, index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function CarouselArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      aria-hidden
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
