"use client";

import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CreateAdminProductInput, ProductUnit } from "./admin-api";
import { createAdminProduct, uploadAdminProductImages } from "./admin-api";

type Tier = { minQty: string; price: string };
type ProductImageInput = { id: string; file: File; previewUrl: string };

const maxProductImages = 10;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function newProductImageInput(file: File): ProductImageInput {
  return {
    id: newId(),
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

function cssImageUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

export function AdminProductNewScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("PACK");
  const [basePrice, setBasePrice] = useState("");
  const [initialAvailableQty, setInitialAvailableQty] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([{ minQty: "", price: "" }]);
  const [images, setImages] = useState<ProductImageInput[]>([]);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      for (const url of previewUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  function addTier() {
    setTiers((current) => [...current, { minQty: "", price: "" }]);
  }

  function updateTier(index: number, patch: Partial<Tier>) {
    setTiers((current) =>
      current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    );
  }

  function addImageFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const validImages = incoming.filter((file) =>
      file.type.startsWith("image/"),
    );
    if (validImages.length !== incoming.length) {
      setError("Only image files can be uploaded for products.");
    }
    if (validImages.length === 0) return;

    const availableSlots = maxProductImages - images.length;
    if (availableSlots <= 0) {
      setError(`You can upload up to ${maxProductImages} product images.`);
      return;
    }
    const nextImages = validImages
      .slice(0, availableSlots)
      .map(newProductImageInput);
    for (const image of nextImages) {
      previewUrlsRef.current.push(image.previewUrl);
    }
    if (validImages.length > availableSlots) {
      setError(`Only the first ${availableSlots} images were added.`);
    }
    setImages((current) => [...current, ...nextImages]);
  }

  function removeImage(id: string) {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.id !== id);
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const selected = next[index];
      if (!selected) return current;
      next[index] = next[nextIndex]!;
      next[nextIndex] = selected;
      return next;
    });
  }

  function setPrimaryImage(index: number) {
    setImages((current) => {
      const selected = current[index];
      if (!selected || index === 0) return current;
      return [selected, ...current.filter((_, i) => i !== index)];
    });
  }

  function reorderImage(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    setImages((current) => {
      const from = current.findIndex((image) => image.id === draggedId);
      const to = current.findIndex((image) => image.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [selected] = next.splice(from, 1);
      if (!selected) return current;
      next.splice(to, 0, selected);
      return next;
    });
  }

  function payload(imageUrls: string[]): CreateAdminProductInput | null {
    const parsedBase = Number(basePrice);
    const parsedStock = Number(initialAvailableQty);
    if (!name.trim()) return null;
    if (!category.trim()) return null;
    if (!Number.isFinite(parsedBase) || parsedBase < 0) return null;
    if (!Number.isFinite(parsedStock) || parsedStock < 0) return null;
    const parsedTiers = tiers
      .filter((tier) => tier.minQty.trim() || tier.price.trim())
      .map((tier) => ({
        minQty: Number(tier.minQty),
        price: Number(tier.price),
      }));
    if (
      parsedTiers.some(
        (tier) =>
          !Number.isInteger(tier.minQty) ||
          tier.minQty < 1 ||
          !Number.isFinite(tier.price) ||
          tier.price < 0,
      )
    ) {
      return null;
    }
    return {
      name: name.trim(),
      category: category.trim().toLowerCase(),
      unit,
      basePrice: parsedBase,
      imageUrls,
      initialAvailableQty: Math.floor(parsedStock),
      bulkPricingTiers: parsedTiers,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload([])) {
      setError("Please complete product fields with valid prices and stock.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const imageUrls = await uploadAdminProductImages(
        images.map((image) => image.file),
      );
      const input = payload(imageUrls);
      if (!input) {
        setError("Please complete product fields with valid prices and stock.");
        return;
      }
      await createAdminProduct(input);
      router.push("/admin/products");
    } catch (err) {
      setError(domainErrorMessage(err, "Could not create product"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-catalog-text">Add new Product</h1>
        <p className="text-sm text-catalog-text-muted">
          Create a product and its starting inventory in one step.
        </p>
      </div>

      <form
        className="space-y-5 rounded-xl border border-catalog-border bg-card p-4 shadow-sm sm:p-5"
        onSubmit={onSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='10" Sugarcane Bagasse Plates'
            required
          />
          <Input
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="plates"
            required
          />
          <label className="flex w-full flex-col gap-1.5 text-sm">
            <span className="font-medium text-heading">Unit</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as ProductUnit)}
              className="min-h-11 rounded-lg border border-input-border bg-input-bg px-3 text-heading outline-none focus:border-border-focus focus:ring-2 focus:ring-primary/20"
            >
              <option value="PACK">PACK</option>
              <option value="PIECE">PIECE</option>
            </select>
          </label>
          <Input
            label="Base price (INR)"
            type="number"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            required
          />
          <Input
            label="Initial available stock"
            type="number"
            min={0}
            step={1}
            value={initialAvailableQty}
            onChange={(e) => setInitialAvailableQty(e.target.value)}
            required
          />
        </div>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-catalog-text">
                Product images
              </h2>
              <p className="text-xs leading-relaxed text-catalog-text-muted">
                Upload images from your system. Drag thumbnails to change the
                buyer display order.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 self-start px-3 text-xs sm:self-auto"
              onClick={() => fileInputRef.current?.click()}
            >
              Pick images
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) addImageFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            className={[
              "flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
              isDraggingUpload
                ? "border-catalog-green bg-catalog-green-muted text-catalog-green"
                : "border-catalog-border bg-catalog-surface/70 text-catalog-text-muted hover:border-catalog-green hover:bg-catalog-green-muted",
            ].join(" ")}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingUpload(true);
            }}
            onDragLeave={() => setIsDraggingUpload(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingUpload(false);
              addImageFiles(e.dataTransfer.files);
            }}
          >
            <span className="text-sm font-bold text-catalog-text">
              Drop product images here
            </span>
            <span className="mt-1 max-w-sm text-xs leading-relaxed">
              or click to pick JPG, PNG, WEBP, or GIF files from your computer.
              Up to {maxProductImages} images.
            </span>
          </button>

          {images.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  draggable
                  className={[
                    "grid cursor-grab gap-3 rounded-lg border bg-catalog-surface/60 p-3 active:cursor-grabbing sm:grid-cols-[5rem_minmax(0,1fr)]",
                    draggingImageId === image.id
                      ? "border-catalog-green ring-2 ring-catalog-green-muted"
                      : "border-catalog-border",
                  ].join(" ")}
                  onDragStart={(e) => {
                    setDraggingImageId(image.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", image.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId =
                      e.dataTransfer.getData("text/plain") || draggingImageId;
                    if (draggedId) reorderImage(draggedId, image.id);
                    setDraggingImageId(null);
                  }}
                  onDragEnd={() => setDraggingImageId(null)}
                >
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-catalog-border bg-card">
                      <div
                        aria-hidden
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: cssImageUrl(image.previewUrl) }}
                      />
                    {index === 0 ? (
                      <span className="absolute left-1 top-1 rounded-full bg-catalog-green px-2 py-0.5 text-[10px] font-bold text-white">
                        First
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div>
                      <p className="truncate text-sm font-bold text-catalog-text">
                        {image.file.name}
                      </p>
                      <p className="text-xs text-catalog-text-muted">
                        Position {index + 1}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 px-3 text-xs"
                        onClick={() => moveImage(index, -1)}
                        disabled={index === 0}
                      >
                        Move up
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 px-3 text-xs"
                        onClick={() => moveImage(index, 1)}
                        disabled={index === images.length - 1}
                      >
                        Move down
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 px-3 text-xs"
                        onClick={() => setPrimaryImage(index)}
                        disabled={index === 0}
                      >
                        Set first
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-9 px-3 text-xs"
                        onClick={() => removeImage(image.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-catalog-text">
              Bulk pricing tiers
            </h2>
            <button
              type="button"
              className="text-xs font-bold text-catalog-green hover:underline"
              onClick={addTier}
            >
              Add tier
            </button>
          </div>
          {tiers.map((tier, index) => (
            <div key={String(index)} className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Minimum quantity"
                type="number"
                min={1}
                step={1}
                value={tier.minQty}
                onChange={(e) => updateTier(index, { minQty: e.target.value })}
              />
              <Input
                label="Tier price (INR)"
                type="number"
                min={0}
                step="0.01"
                value={tier.price}
                onChange={(e) => updateTier(index, { price: e.target.value })}
              />
            </div>
          ))}
        </section>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Create Product"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/admin/products")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
