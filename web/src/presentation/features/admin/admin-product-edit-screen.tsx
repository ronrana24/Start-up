"use client";

import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Select } from "@presentation/components/ui/select";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@presentation/lib/cn";
import { ProductCategory } from "../../../../public/constants/product-category";
import type {
  AdminAnalyticsRange,
  AdminProduct,
  ProductUnit,
  UpdateAdminProductInput,
} from "./admin-api";
import {
  getAdminProductAnalytics,
  getAdminProduct,
  updateAdminProduct,
  uploadAdminProductImages,
} from "./admin-api";
import { formatInr } from "./admin-format";
import { useAdminQuery } from "./use-admin-query";

type Tier = { minQty: string; price: string };
type EditableImage = {
  id: string;
  previewUrl: string;
  existingUrl?: string;
  file?: File;
};
type PriceInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "type"
> & {
  label: string;
};

const minProductImages = 4;
const maxProductImages = 10;
const productCategoryOptions = Object.values(ProductCategory);
const rangeOptions: Array<{ value: AdminAnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function cssImageUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

function formatCount(value: number | string): string {
  return new Intl.NumberFormat("en-IN").format(Number(value));
}

function PriceInput({ label, id, ...props }: PriceInputProps) {
  const inputId = id ?? props.name;
  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      <span className="font-medium text-heading">{label}</span>
      <div className="flex min-h-11 overflow-hidden rounded-lg border border-input-border bg-input-bg shadow-sm transition-shadow focus-within:border-border-focus focus-within:ring-2 focus-within:ring-primary/20">
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

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-catalog-border bg-card p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-catalog-text">{value}</p>
      <p className="mt-1 text-xs text-catalog-text-muted">{hint}</p>
    </div>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-catalog-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-bold text-catalog-text">{title}</h2>
      <div className="mt-4 h-64">{children}</div>
    </section>
  );
}

function ProductAnalyticsPanel({ productId }: { productId: string }) {
  const [range, setRange] = useState<AdminAnalyticsRange>("30d");
  const { data, error, isLoading } = useAdminQuery(
    ["admin", "product-analytics", productId, range],
    () => getAdminProductAnalytics(productId, range),
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-catalog-text">
            Product analytics
          </h2>
          <p className="text-sm text-catalog-text-muted">
            Ordered quantity, revenue, and demand by delivery location.
          </p>
        </div>
        <div className="flex rounded-lg border border-catalog-border bg-card p-1">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "min-h-9 rounded-md px-3 text-xs font-bold transition-colors",
                range === option.value
                  ? "bg-catalog-green text-white"
                  : "text-catalog-text-muted hover:bg-catalog-input hover:text-catalog-text",
              )}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={String(index)}
              className="h-32 animate-pulse rounded-xl bg-catalog-input"
            />
          ))}
        </div>
      ) : error || !data ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? "Could not load product analytics."}
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Ordered quantity"
              value={formatCount(data.totals.quantityOrdered)}
              hint="Total units from non-cancelled orders"
            />
            <MetricCard
              label="Orders"
              value={formatCount(data.totals.orders)}
              hint={`${formatCount(data.totals.buyers)} unique buyers`}
            />
            <MetricCard
              label="Revenue"
              value={formatInr(data.totals.revenue)}
              hint="Line revenue for this product"
            />
            <MetricCard
              label="Avg unit price"
              value={formatInr(data.totals.averageUnitPrice)}
              hint="Revenue divided by ordered quantity"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartPanel title="Ordered quantity trend">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.orderTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="quantity"
                    stroke="#0f5132"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Orders by delivery location">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ordersByLocation}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
                  <XAxis
                    dataKey="location"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    height={70}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatCount(Number(value))} />
                  <Bar
                    dataKey="quantity"
                    fill="#052c65"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <div className="overflow-hidden rounded-xl border border-catalog-border bg-card shadow-sm">
            <div className="border-b border-catalog-border bg-catalog-surface px-4 py-3">
              <h3 className="text-sm font-bold text-catalog-text">
                Location breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-catalog-text-muted">
                  <tr>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Orders</th>
                    <th className="px-4 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-catalog-border">
                  {data.ordersByLocation.length ? (
                    data.ordersByLocation.map((location) => (
                      <tr key={location.location}>
                        <td className="px-4 py-3 font-semibold text-catalog-text">
                          {location.location}
                        </td>
                        <td className="px-4 py-3">
                          {formatCount(location.quantity)}
                        </td>
                        <td className="px-4 py-3">
                          {formatCount(location.orders)}
                        </td>
                        <td className="px-4 py-3">
                          {formatInr(location.revenue)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-catalog-text-muted"
                      >
                        No orders for this product in the selected range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function imageFromUrl(url: string, index: number): EditableImage {
  return {
    id: `${url}-${index}`,
    previewUrl: url,
    existingUrl: url,
  };
}

function imageFromFile(file: File): EditableImage {
  return {
    id: newId(),
    previewUrl: URL.createObjectURL(file),
    file,
  };
}

function formTiers(product: AdminProduct): Tier[] {
  const tiers = product.bulkPricingTiers ?? [];
  if (tiers.length === 0) return [{ minQty: "", price: "" }];
  return tiers.map((tier) => ({
    minQty: String(tier.minQty),
    price: String(tier.price),
  }));
}

export function AdminProductEditScreen() {
  const params = useParams<{ productId: string }>();
  const productId = params?.productId ?? "";

  const {
    data: product,
    error,
    isLoading,
  } = useAdminQuery(["admin", "product", productId], () =>
    getAdminProduct(productId),
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="h-8 w-56 animate-pulse rounded bg-catalog-input" />
        <div className="h-96 animate-pulse rounded-xl bg-catalog-input" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? "Product not found."}
      </div>
    );
  }

  return (
    <AdminProductEditForm
      key={product.id}
      product={product}
      productId={productId}
    />
  );
}

function AdminProductEditForm({
  product,
  productId,
}: {
  product: AdminProduct;
  productId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [unit, setUnit] = useState<ProductUnit>(product.unit);
  const [piecesPerPack, setPiecesPerPack] = useState(
    product.piecesPerPack ? String(product.piecesPerPack) : "",
  );
  const [isPublic, setIsPublic] = useState(product.isPublic);
  const [basePrice, setBasePrice] = useState(String(product.basePrice));
  const [availableQty, setAvailableQty] = useState(
    String(product.inventory?.availableQty ?? 0),
  );
  const [tiers, setTiers] = useState<Tier[]>(() => formTiers(product));
  const [images, setImages] = useState<EditableImage[]>(() =>
    (product.imageUrls ?? []).map(imageFromUrl),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      for (const url of previewUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const categoryOptions = useMemo(() => {
    if (
      !category ||
      productCategoryOptions.includes(category as ProductCategory)
    ) {
      return productCategoryOptions;
    }
    return [category, ...productCategoryOptions];
  }, [category]);

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
      setFormError("Only image files can be uploaded for products.");
    }
    if (validImages.length === 0) return;

    const availableSlots = maxProductImages - images.length;
    if (availableSlots <= 0) {
      setFormError(`You can upload up to ${maxProductImages} product images.`);
      return;
    }
    const nextImages = validImages.slice(0, availableSlots).map(imageFromFile);
    for (const image of nextImages) {
      previewUrlsRef.current.push(image.previewUrl);
    }
    setImages((current) => [...current, ...nextImages]);
  }

  function removeImage(id: string) {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed?.file) URL.revokeObjectURL(removed.previewUrl);
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

  function payload(imageUrls: string[]): UpdateAdminProductInput | null {
    const parsedBase = Number(basePrice);
    const parsedAvailable = Number(availableQty);
    const parsedPiecesPerPack = Number(piecesPerPack);
    if (!name.trim()) return null;
    if (!category.trim()) return null;
    if (!Number.isFinite(parsedBase) || parsedBase < 0) return null;
    if (!Number.isFinite(parsedAvailable) || parsedAvailable < 0) return null;
    if (
      unit === "PACK" &&
      (!Number.isInteger(parsedPiecesPerPack) || parsedPiecesPerPack < 1)
    ) {
      return null;
    }
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
      category: category.trim(),
      unit,
      ...(unit === "PACK" ? { piecesPerPack: parsedPiecesPerPack } : {}),
      isPublic,
      basePrice: parsedBase,
      imageUrls,
      initialAvailableQty: Math.floor(parsedAvailable),
      bulkPricingTiers: parsedTiers,
    };
  }

  async function orderedImageUrls(): Promise<string[]> {
    const uploadable = images.filter((image) => image.file);
    const uploadedUrls = await uploadAdminProductImages(
      uploadable.map((image) => image.file!),
    );
    const uploadedById = new Map(
      uploadable.map((image, index) => [image.id, uploadedUrls[index] ?? ""]),
    );
    return images
      .map((image) => image.existingUrl ?? uploadedById.get(image.id) ?? "")
      .filter(Boolean);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const draft = payload([]);
    if (!draft) {
      setFormError(
        "Please complete product fields with valid prices, stock, and pack details.",
      );
      return;
    }
    if (images.length < minProductImages) {
      setFormError(`Add at least ${minProductImages} product images.`);
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const imageUrls = await orderedImageUrls();
      const input = payload(imageUrls);
      if (!input) {
        setFormError(
          "Please complete product fields with valid prices, stock, and pack details.",
        );
        return;
      }
      await updateAdminProduct(productId, input);
      router.push("/admin/products");
    } catch (err) {
      setFormError(domainErrorMessage(err, "Could not update product"));
    } finally {
      setIsSaving(false);
    }
  }

  const availableUnitLabel = unit === "PACK" ? "packs" : "pieces";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-catalog-text">Edit Product</h1>
          <p className="text-sm text-catalog-text-muted">
            Update catalog, inventory, image order, and bulk pricing details.
          </p>
        </div>
        <Link
          href="/admin/products"
          className="text-sm font-bold text-catalog-green hover:underline"
        >
          Back to products
        </Link>
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
            required
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">Select category</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
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
            <Input
              label="Pieces in one pack"
              type="number"
              min={1}
              step={1}
              value={piecesPerPack}
              onChange={(e) => setPiecesPerPack(e.target.value)}
              required
            />
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
                Public products are visible to buyers in the catalog. Turn this
                off to hide the product without deleting it.
              </span>
            </span>
          </label>
          <PriceInput
            label="Cost Price"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            required
          />
          <div className="space-y-1">
            <Input
              label="Available Quantity"
              type="number"
              min={0}
              step={1}
              value={availableQty}
              onChange={(e) => setAvailableQty(e.target.value)}
              required
            />
            <p className="px-1 text-xs leading-relaxed text-catalog-text-muted">
              You have {availableQty || "0"} {availableUnitLabel} available.
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
                Reorder, remove, or add product images. Keep at least{" "}
                {minProductImages} and up to {maxProductImages} images.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 self-start px-3 text-xs sm:self-auto"
              onClick={() => fileInputRef.current?.click()}
            >
              Add images
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

          {images.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className="grid gap-3 rounded-lg border border-catalog-border bg-catalog-surface/60 p-3 sm:grid-cols-[5rem_minmax(0,1fr)]"
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
                    <p className="truncate text-sm font-bold text-catalog-text">
                      Image {index + 1}
                    </p>
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
          ) : (
            <button
              type="button"
              className="flex min-h-24 w-full items-center justify-center rounded-xl border border-dashed border-catalog-border bg-catalog-surface/70 px-4 text-sm font-semibold text-catalog-text-muted hover:border-catalog-green hover:bg-catalog-green-muted hover:text-catalog-green"
              onClick={() => fileInputRef.current?.click()}
            >
              Add product images
            </button>
          )}
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
                  min={1}
                  step={1}
                  value={tier.minQty}
                  onChange={(e) =>
                    updateTier(index, { minQty: e.target.value })
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

        {formError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
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

      <ProductAnalyticsPanel productId={productId} />
    </div>
  );
}
