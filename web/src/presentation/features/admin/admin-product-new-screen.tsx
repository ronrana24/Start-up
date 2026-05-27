"use client";

import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Select } from "@presentation/components/ui/select";
import {
  IconBookmark,
  IconCartPlus,
  IconCheckCircle,
  IconShare,
  IconTags,
} from "@presentation/features/product-detail/pdp-icons";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import { formatMoney } from "@presentation/lib/format-money";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { ProductCategory } from "../../../../public/constants/product-category";
import type {
  CreateAdminProductInput,
  ProductCategoryEnum,
  ProductUnit,
} from "./admin-api";
import { createAdminProduct, uploadAdminProductImages } from "./admin-api";
import {
  blockNonIntegerKeys,
  digitsOnly,
  sanitizeIntegerPaste,
} from "./admin-input";

const productCategoryEntries = Object.entries(ProductCategory) as Array<
  [ProductCategoryEnum, string]
>;

type Tier = { minQty: string; price: string };
type ProductImageInput = { id: string; file: File; previewUrl: string };
type PreviewTier = { minQty: number; priceCents: number };
type PriceInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "type"
> & {
  label: string;
};

const minProductImages = 4;
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

function rupeeCents(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function previewTierQuantityLabel(tier: PreviewTier): string {
  return `${tier.minQty}+ units`;
}

function unitText(unit: ProductUnit): string {
  return unit.toLowerCase();
}

function PriceInput({ label, id, ...props }: PriceInputProps) {
  const inputId = id ?? props.name;
  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      <span className="font-medium text-heading">{label}</span>
      <div className="group flex min-h-11 overflow-hidden rounded-lg border border-input-border bg-input-bg shadow-sm transition-shadow focus-within:border-border-focus focus-within:ring-2 focus-within:ring-primary/20">
        <span className="flex w-11 shrink-0 items-center justify-center border-r border-input-border bg-catalog-green-muted text-base font-black text-catalog-green">
          ₹
        </span>
        <input
          id={inputId}
          type="number"
          className="min-h-11 w-full bg-transparent px-3 text-heading outline-none placeholder:text-input-placeholder"
          {...props}
        />
      </div>
    </label>
  );
}

function BuyerProductPreviewModal({
  name,
  category,
  unit,
  piecesPerPack,
  basePrice,
  initialAvailableQty,
  tiers,
  images,
  onClose,
}: {
  name: string;
  category: string;
  unit: ProductUnit;
  piecesPerPack: string;
  basePrice: string;
  initialAvailableQty: string;
  tiers: Tier[];
  images: ProductImageInput[];
  onClose: () => void;
}) {
  const title = name.trim() || "Product name preview";
  const brand = category.trim() || "Category";
  const unitLabel = unitText(unit);
  const basePriceCents = rupeeCents(basePrice);
  const availableQty = Number(initialAvailableQty);
  const inStock = Number.isFinite(availableQty) && availableQty > 0;
  const packSizeNote =
    unit === "PACK"
      ? `${piecesPerPack.trim() || "0"} pieces per pack`
      : "Sold by piece";
  const gallery = images.map((image) => image.previewUrl);
  const hero = gallery[0] ?? "/placeholder-product.svg";
  const previewTiers: PreviewTier[] = tiers
    .filter((tier) => tier.minQty.trim() || tier.price.trim())
    .map((tier) => ({
      minQty: Number(tier.minQty),
      priceCents: rupeeCents(tier.price),
    }))
    .filter(
      (tier) =>
        Number.isInteger(tier.minQty) &&
        tier.minQty > 0 &&
        Number.isFinite(tier.priceCents) &&
        tier.priceCents >= 0,
    )
    .sort((a, b) => a.minQty - b.minQty);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Buyer product preview"
    >
      <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-t-2xl border border-catalog-border bg-catalog-surface shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-catalog-border bg-card px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-catalog-green">
              Buyer preview
            </p>
            <h2 className="text-sm font-bold text-catalog-text">
              How customers will see this product
            </h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 px-3 text-xs"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        <div className="max-h-[calc(94vh-4rem)] overflow-y-auto p-3 sm:p-5">
          <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-default bg-page shadow-sm">
            <div className="h-1 w-full bg-primary" />
            <div className="sticky top-0 z-10 border-b border-default/60 bg-page/95 px-4 py-3 backdrop-blur">
              <header className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-heading">
                  <span className="text-lg leading-none">‹</span>
                </span>
                <span className="text-sm font-semibold text-heading">
                  Product details
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-heading">
                  <IconShare className="h-5 w-5" />
                </span>
              </header>
            </div>

            <section className="overflow-hidden border-b border-default/60 bg-card">
              <div className="relative flex h-[280px] items-center justify-center bg-input-bg p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
                <span className="absolute left-4 top-4 rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  Preview
                </span>
                <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-card text-secondary shadow-md ring-1 ring-default">
                  <IconBookmark className="h-4 w-4" />
                </span>
              </div>
              {gallery.length > 1 ? (
                <div className="no-scrollbar flex gap-2 overflow-x-auto p-4">
                  {gallery.map((src, index) => (
                    <div
                      key={`${src}-${index}`}
                      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-default bg-input-bg p-1"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="mt-2 space-y-3 border-b border-default/60 bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {brand} • PREVIEW
              </p>
              <h1 className="text-xl font-bold leading-tight text-heading">
                {title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  <IconCheckCircle />
                  {inStock ? "In stock" : "Stock not added yet"}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <span className="text-2xl font-bold text-heading">
                  {formatMoney(basePriceCents, "INR")}
                </span>
                <span className="mb-1 text-sm font-medium text-muted">
                  / {unitLabel}
                </span>
              </div>
              <p className="text-xs text-muted">{packSizeNote}</p>
              <p className="text-sm leading-relaxed text-secondary">
                {title} for wholesale disposable supply orders.
              </p>
            </section>

            <section className="mt-2 space-y-4 border-y border-default/60 bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-heading">
                <IconTags className="h-4 w-4 text-primary" />
                Bulk pricing tiers
              </h2>
              {previewTiers.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-default/60">
                  <div className="grid grid-cols-3 gap-0 bg-secondary-bg px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                    <span>Quantity</span>
                    <span className="text-center">Price / {unitLabel}</span>
                    <span className="text-right">Savings</span>
                  </div>
                  {previewTiers.map((tier, index) => {
                    const savings = Math.max(
                      0,
                      basePriceCents - tier.priceCents,
                    );
                    return (
                      <div
                        key={`${tier.minQty}-${index}`}
                        className="grid grid-cols-3 items-center border-t border-default/40 px-3 py-3 text-xs"
                      >
                        <div className="font-semibold text-heading">
                          {previewTierQuantityLabel(tier)}
                        </div>
                        <div className="text-center font-bold text-heading">
                          {formatMoney(tier.priceCents, "INR")}
                        </div>
                        <div className="text-right font-semibold text-muted">
                          {savings > 0
                            ? `${formatMoney(savings, "INR")} off`
                            : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-default/60 bg-page p-4 text-sm text-secondary">
                  No bulk tiers added yet. Buyers will see the base price.
                </div>
              )}

              <div className="rounded-xl border border-default/60 bg-page p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-heading">
                    Quantity ({unitLabel}s)
                  </span>
                  <span className="text-xs font-medium text-muted">
                    MOQ: 1 {unitLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-default/60 pt-3 text-sm">
                  <span className="font-medium text-muted">Subtotal</span>
                  <span className="text-xl font-bold text-heading">
                    {formatMoney(basePriceCents, "INR")}
                  </span>
                </div>
              </div>
            </section>

            <div className="border-t border-default bg-card px-3 py-3">
              <Button type="button" className="w-full gap-2" disabled>
                <IconCartPlus className="h-4 w-4" />
                Add 1 {unitLabel} to cart
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminProductNewScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategoryEnum | "">("");
  const [unit, setUnit] = useState<ProductUnit>("PACK");
  const [piecesPerPack, setPiecesPerPack] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  // Initial inventory batch (batchNumber = 1) created with the product.
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [initialAvailableQty, setInitialAvailableQty] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([{ minQty: "", price: "" }]);
  const [images, setImages] = useState<ProductImageInput[]>([]);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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

  function removeTier(index: number) {
    setTiers((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, i) => i !== index);
    });
  }

  function updateTier(index: number, patch: Partial<Tier>) {
    setTiers((current) =>
      current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    );
  }

  function updateUnit(nextUnit: ProductUnit) {
    setUnit(nextUnit);
    if (nextUnit === "PIECE") {
      setPiecesPerPack("");
    }
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

  /**
   * Validate the form once, in field order, and return either the validated
   * primitives or a precise user-facing error message. Splitting validation
   * from payload assembly lets `onSubmit` surface the exact reason a submit
   * was rejected (instead of a generic "fix the fields" toast).
   */
  function validateForm():
    | {
        ok: true;
        values: {
          name: string;
          category: ProductCategoryEnum;
          unit: ProductUnit;
          piecesPerPack?: number;
          costPrice: number;
          sellingPrice: number;
          quantity: number;
          bulkTiers: Array<{ minimumQuantity: number; pricePerUnit: number }>;
        };
      }
    | { ok: false; error: string } {
    if (!name.trim()) {
      return { ok: false, error: "Please enter a product name." };
    }
    if (!category) {
      return { ok: false, error: "Please select a product category." };
    }

    const parsedPiecesPerPack = Number(piecesPerPack);
    let piecesPerPackValue: number | undefined;
    if (unit === "PACK") {
      if (
        !piecesPerPack.trim() ||
        !Number.isInteger(parsedPiecesPerPack) ||
        parsedPiecesPerPack < 1
      ) {
        return {
          ok: false,
          error:
            'Pieces per pack must be a whole number of 1 or more when the unit is "PACK".',
        };
      }
      piecesPerPackValue = parsedPiecesPerPack;
    }

    if (!costPrice.trim()) {
      return {
        ok: false,
        error: "Please enter the cost price for the initial batch.",
      };
    }
    const parsedCost = Number(costPrice);
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      return {
        ok: false,
        error: "Cost price must be a number greater than or equal to 0.",
      };
    }

    if (!sellingPrice.trim()) {
      return {
        ok: false,
        error: "Please enter the selling price for the initial batch.",
      };
    }
    const parsedSelling = Number(sellingPrice);
    if (!Number.isFinite(parsedSelling) || parsedSelling < 0) {
      return {
        ok: false,
        error: "Selling price must be a number greater than or equal to 0.",
      };
    }

    if (!initialAvailableQty.trim()) {
      return {
        ok: false,
        error: "Please enter the initial batch quantity.",
      };
    }
    const parsedStock = Number(initialAvailableQty);
    if (!Number.isInteger(parsedStock) || parsedStock < 1) {
      return {
        ok: false,
        error: "Initial batch quantity must be a whole number of 1 or more.",
      };
    }

    const filledTiers = tiers.filter(
      (tier) => tier.minQty.trim() || tier.price.trim(),
    );
    if (filledTiers.length < 1) {
      return {
        ok: false,
        error:
          "Add at least 1 bulk pricing tier for the initial batch — every batch needs at least one tier.",
      };
    }
    if (filledTiers.length > 3) {
      return {
        ok: false,
        error: "A batch can have at most 3 bulk pricing tiers.",
      };
    }

    const parsedTiers: Array<{
      minimumQuantity: number;
      pricePerUnit: number;
    }> = [];
    const seenMinQty = new Set<number>();
    for (let i = 0; i < filledTiers.length; i++) {
      const tier = filledTiers[i]!;
      const tierLabel = `Tier ${i + 1}`;
      if (!tier.minQty.trim()) {
        return {
          ok: false,
          error: `${tierLabel}: enter a minimum quantity.`,
        };
      }
      const minimumQuantity = Number(tier.minQty);
      if (!Number.isInteger(minimumQuantity) || minimumQuantity < 1) {
        return {
          ok: false,
          error: `${tierLabel}: minimum quantity must be a whole number of 1 or more.`,
        };
      }
      if (minimumQuantity > parsedStock) {
        return {
          ok: false,
          error: `${tierLabel}: minimum quantity (${minimumQuantity}) cannot exceed the initial batch quantity (${parsedStock}).`,
        };
      }
      if (seenMinQty.has(minimumQuantity)) {
        return {
          ok: false,
          error: `${tierLabel}: another tier already uses minimum quantity ${minimumQuantity}. Use distinct values.`,
        };
      }
      seenMinQty.add(minimumQuantity);

      if (!tier.price.trim()) {
        return {
          ok: false,
          error: `${tierLabel}: enter a price per unit.`,
        };
      }
      const pricePerUnit = Number(tier.price);
      if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
        return {
          ok: false,
          error: `${tierLabel}: price per unit must be a number greater than or equal to 0.`,
        };
      }
      parsedTiers.push({ minimumQuantity, pricePerUnit });
    }

    return {
      ok: true,
      values: {
        name: name.trim(),
        category,
        unit,
        ...(piecesPerPackValue !== undefined
          ? { piecesPerPack: piecesPerPackValue }
          : {}),
        costPrice: parsedCost,
        sellingPrice: parsedSelling,
        quantity: Math.floor(parsedStock),
        bulkTiers: parsedTiers,
      },
    };
  }

  function buildPayload(
    values: Extract<ReturnType<typeof validateForm>, { ok: true }>["values"],
    imageUrls: string[],
  ): CreateAdminProductInput {
    return {
      name: values.name,
      category: values.category,
      unit: values.unit,
      ...(values.piecesPerPack !== undefined
        ? { piecesPerPack: values.piecesPerPack }
        : {}),
      isPublic,
      imageUrls,
      initialBatch: {
        costPrice: values.costPrice,
        sellingPrice: values.sellingPrice,
        quantity: values.quantity,
        bulkTiers: values.bulkTiers,
      },
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateForm();
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    if (images.length < minProductImages) {
      setError(
        `Add at least ${minProductImages} product images (you have ${images.length}).`,
      );
      return;
    }
    if (images.length > maxProductImages) {
      setError(
        `You can upload at most ${maxProductImages} product images (you have ${images.length}).`,
      );
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const imageUrls = await uploadAdminProductImages(
        images.map((image) => image.file),
      );
      if (imageUrls.length !== images.length) {
        setError(
          "Some images failed to upload. Remove the failed ones or try again.",
        );
        return;
      }
      const input = buildPayload(validation.values, imageUrls);
      await createAdminProduct(input);
      router.push("/admin/products");
    } catch (err) {
      setError(domainErrorMessage(err, "Could not create product"));
    } finally {
      setIsSaving(false);
    }
  }

  const availableQuantityLabel = initialAvailableQty.trim() || "0";
  const piecesPerPackLabel = piecesPerPack.trim() || "0";
  const availableUnitLabel =
    unit === "PACK"
      ? Number(availableQuantityLabel) === 1
        ? "pack"
        : "packs"
      : Number(availableQuantityLabel) === 1
        ? "piece"
        : "pieces";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-catalog-text">
          Add new Product
        </h1>
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
          <Select
            label="Category"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as ProductCategoryEnum | "")
            }
            required
          >
            <option value="">Select category</option>
            {productCategoryEntries.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Unit"
            value={unit}
            onChange={(e) => updateUnit(e.target.value as ProductUnit)}
          >
            <option value="PACK">PACK</option>
            <option value="PIECE">PIECE</option>
          </Select>
          {unit === "PACK" ? (
            <div className="space-y-1">
              <Input
                label="Pieces in one pack"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                step={1}
                value={piecesPerPack}
                onKeyDown={blockNonIntegerKeys}
                onPaste={(event) =>
                  sanitizeIntegerPaste(event, setPiecesPerPack)
                }
                onChange={(e) => setPiecesPerPack(digitsOnly(e.target.value))}
                required
              />
              <p className="px-1 text-xs leading-relaxed text-catalog-text-muted">
                Each pack contains {piecesPerPackLabel}{" "}
                {Number(piecesPerPackLabel) === 1 ? "piece" : "pieces"}.
              </p>
            </div>
          ) : null}
          <label className="flex min-h-11 items-start gap-3 rounded-lg border border-catalog-border bg-catalog-surface px-3 py-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-catalog-border text-catalog-green focus:ring-catalog-green/30"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>
              <span className="block font-bold text-catalog-text">
                Make product public
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-catalog-text-muted">
                Public products are visible to buyers in the catalog. Keep this
                unchecked to save the product as an internal draft.
              </span>
            </span>
          </label>
          <div className="space-y-1">
            <PriceInput
              label="Cost price (initial batch)"
              min={0}
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              required
            />
            <p className="px-1 text-xs leading-relaxed text-catalog-text-muted">
              What you paid per {availableUnitLabel} for this batch.
            </p>
          </div>

          <div className="space-y-1">
            <PriceInput
              label="Selling price (initial batch)"
              min={0}
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              required
            />
            <p className="px-1 text-xs leading-relaxed text-catalog-text-muted">
              <b>{name.trim()}</b> will be sold at <b>{sellingPrice}</b> per-{availableUnitLabel} price for buyers when no bulk
              tier applies.
            </p>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Input
              label="Initial batch quantity"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={1}
              step={1}
              value={initialAvailableQty}
              onKeyDown={blockNonIntegerKeys}
              onPaste={(event) =>
                sanitizeIntegerPaste(event, setInitialAvailableQty)
              }
              onChange={(e) =>
                setInitialAvailableQty(digitsOnly(e.target.value))
              }
              required
            />
            <p className="px-1 text-xs leading-relaxed text-catalog-text-muted">
              You will start with {availableQuantityLabel} {availableUnitLabel}.
              This becomes batch #1 — every later restock creates a new batch.
            </p>
          </div>
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
              Add {minProductImages} to {maxProductImages} images.
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
            <div>
              <h2 className="text-sm font-bold text-catalog-text">
                Bulk pricing tiers (initial batch)
              </h2>
              <p className="text-xs text-catalog-text-muted">
                Required: 1–3 tiers. Each tier&apos;s minimum quantity must not
                exceed the batch&apos;s available quantity.
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-bold text-catalog-green hover:underline disabled:cursor-not-allowed disabled:text-catalog-text-muted"
              onClick={addTier}
              disabled={tiers.length >= 3}
            >
              Add tier
            </button>
          </div>
          {tiers.map((tier, index) => (
            <div key={String(index)} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-catalog-text-muted">
                  Tier {index + 1}
                </p>
                {tiers.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-bold text-red-600 hover:underline"
                    onClick={() => removeTier(index)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Minimum quantity"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  step={1}
                  value={tier.minQty}
                  onKeyDown={blockNonIntegerKeys}
                  onPaste={(event) =>
                    sanitizeIntegerPaste(event, (value) =>
                      updateTier(index, { minQty: value }),
                    )
                  }
                  onChange={(e) =>
                    updateTier(index, { minQty: digitsOnly(e.target.value) })
                  }
                />
                <PriceInput
                  label="Tier price"
                  min={0}
                  step="0.01"
                  value={tier.price}
                  onChange={(e) => updateTier(index, { price: e.target.value })}
                />
              </div>
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
            onClick={() => setPreviewOpen(true)}
          >
            Preview
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

      {previewOpen ? (
        <BuyerProductPreviewModal
          name={name}
          category={
            category
              ? (ProductCategory[
                  category as keyof typeof ProductCategory
                ] as string)
              : ""
          }
          unit={unit}
          piecesPerPack={piecesPerPack}
          basePrice={sellingPrice}
          initialAvailableQty={initialAvailableQty}
          tiers={tiers}
          images={images}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
