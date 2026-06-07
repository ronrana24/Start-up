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
  ProductCategoryEnum,
  ProductUnit,
  UpdateAdminProductInput,
} from "./admin-api";
import {
  createProductBatch,
  getAdminProductAnalytics,
  getAdminProduct,
  listProductBatches,
  updateAdminProduct,
  uploadAdminProductImages,
} from "./admin-api";
import { formatInr } from "./admin-format";
import {
  blockNonIntegerKeys,
  digitsOnly,
  sanitizeIntegerPaste,
} from "./admin-input";
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
const productCategoryEntries = Object.entries(ProductCategory) as Array<
  [ProductCategoryEnum, string]
>;
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
  const [category, setCategory] = useState<ProductCategoryEnum>(product.category);
  const [unit, setUnit] = useState<ProductUnit>(product.unit);
  const [piecesPerPack, setPiecesPerPack] = useState(
    product.piecesPerPack ? String(product.piecesPerPack) : "",
  );
  const [isPublic, setIsPublic] = useState(product.isPublic);
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
    const parsedPiecesPerPack = Number(piecesPerPack);
    if (!name.trim()) return null;
    if (!category) return null;
    if (
      unit === "PACK" &&
      (!Number.isInteger(parsedPiecesPerPack) || parsedPiecesPerPack < 1)
    ) {
      return null;
    }
    return {
      name: name.trim(),
      category,
      unit,
      ...(unit === "PACK" ? { piecesPerPack: parsedPiecesPerPack } : {}),
      isPublic,
      imageUrls,
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
        "Please complete product fields with a valid name, category, and pack details.",
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
          "Please complete product fields with a valid name, category, and pack details.",
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
            disabled={true}
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as ProductCategoryEnum)
            }
            required
            disabled={true}
          >
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
            disabled={true}
          >
            <option value="PACK">PACK</option>
            <option value="PIECE">PIECE</option>
          </Select>
          {unit === "PACK" ? (
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
              disabled={true}
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
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 sm:col-span-2">
            Pricing and stock are managed per inventory batch. Use the
            &quot;Inventory batches&quot; section below to add new batches with
            their own cost / selling price and bulk tiers.
          </p>
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

      <InventoryBatchesPanel productId={productId} />

      <ProductAnalyticsPanel productId={productId} />
    </div>
  );
}

function InventoryBatchesPanel({ productId }: { productId: string }) {
  const { data, error, isLoading, refetch } = useAdminQuery(
    ["admin", "product-batches", productId],
    () => listProductBatches(productId),
  );

  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [batchTiers, setBatchTiers] = useState<Tier[]>([
    { minQty: "", price: "" },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addBatchTier() {
    setBatchTiers((current) => {
      if (current.length >= 3) return current;
      return [...current, { minQty: "", price: "" }];
    });
  }

  function removeBatchTier(index: number) {
    setBatchTiers((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, i) => i !== index);
    });
  }

  function updateBatchTier(index: number, patch: Partial<Tier>) {
    setBatchTiers((current) =>
      current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsedCost = Number(costPrice);
    const parsedSelling = Number(sellingPrice);
    const parsedQty = Number(quantity);
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setFormError("Enter a valid cost price.");
      return;
    }
    if (!Number.isFinite(parsedSelling) || parsedSelling < 0) {
      setFormError("Enter a valid selling price.");
      return;
    }
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      setFormError("Quantity must be a positive whole number.");
      return;
    }
    const parsedTiers: Array<{
      minimumQuantity: number;
      pricePerUnit: number;
    }> = [];
    for (const tier of batchTiers) {
      if (!tier.minQty.trim() && !tier.price.trim()) continue;
      const minimumQuantity = Number(tier.minQty);
      const pricePerUnit = Number(tier.price);
      if (!Number.isInteger(minimumQuantity) || minimumQuantity < 1) {
        setFormError("Tier minimum quantity must be a positive whole number.");
        return;
      }
      if (minimumQuantity > parsedQty) {
        setFormError(
          "Tier minimum quantity cannot exceed the batch quantity.",
        );
        return;
      }
      if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
        setFormError("Tier price must be a non-negative number.");
        return;
      }
      parsedTiers.push({ minimumQuantity, pricePerUnit });
    }
    if (parsedTiers.length < 1) {
      setFormError("Add at least 1 bulk tier for this batch.");
      return;
    }
    if (parsedTiers.length > 3) {
      setFormError("A batch can have at most 3 bulk tiers.");
      return;
    }
    const seenMinQty = new Set<number>();
    for (const tier of parsedTiers) {
      if (seenMinQty.has(tier.minimumQuantity)) {
        setFormError("Each bulk tier must use a distinct minimum quantity.");
        return;
      }
      seenMinQty.add(tier.minimumQuantity);
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createProductBatch(productId, {
        costPrice: parsedCost,
        sellingPrice: parsedSelling,
        quantity: parsedQty,
        bulkTiers: parsedTiers,
      });
      setCostPrice("");
      setSellingPrice("");
      setQuantity("");
      setBatchTiers([{ minQty: "", price: "" }]);
      await refetch();
    } catch (err) {
      setFormError(domainErrorMessage(err, "Could not create batch"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-catalog-border bg-card p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-xl font-bold text-catalog-text">
          Inventory batches
        </h2>
        <p className="text-sm text-catalog-text-muted">
          Each restock creates a new batch. Older batches are sold first (FIFO);
          buyers always see the price of the oldest available batch.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-lg border border-catalog-border bg-catalog-surface/60 p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={onSubmit}
      >
        <PriceInput
          label="Cost price"
          min={0}
          step="0.01"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          required
        />
        <PriceInput
          label="Selling price"
          min={0}
          step="0.01"
          value={sellingPrice}
          onChange={(e) => setSellingPrice(e.target.value)}
          required
        />
        <Input
          label="Quantity"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={1}
          step={1}
          value={quantity}
          onKeyDown={blockNonIntegerKeys}
          onPaste={(event) => sanitizeIntegerPaste(event, setQuantity)}
          onChange={(e) => setQuantity(digitsOnly(e.target.value))}
          required
        />

        <div className="space-y-3 rounded-lg border border-dashed border-catalog-border bg-card p-3 sm:col-span-2 lg:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-catalog-text">
                Batch bulk pricing tiers
              </h3>
              <p className="text-xs leading-relaxed text-catalog-text-muted">
                Required: 1–3 tiers. Each tier&apos;s minimum quantity must not
                exceed the batch quantity. When a buyer&apos;s total order qty
                meets a tier, units served from this batch use that price;
                otherwise the batch selling price applies.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-catalog-green-border bg-catalog-green-muted px-3.5 py-2 text-sm font-bold text-catalog-green shadow-sm transition-colors hover:bg-catalog-green hover:text-white disabled:cursor-not-allowed disabled:border-catalog-border disabled:bg-card disabled:text-catalog-text-muted disabled:shadow-none"
              onClick={addBatchTier}
              disabled={batchTiers.length >= 3}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add tier
            </button>
          </div>
          {batchTiers.map((tier, index) => (
            <div key={String(index)} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-catalog-text-muted">
                  Tier {index + 1}
                </p>
                {batchTiers.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-bold text-red-600 hover:underline"
                    onClick={() => removeBatchTier(index)}
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
                      updateBatchTier(index, { minQty: value }),
                    )
                  }
                  onChange={(e) =>
                    updateBatchTier(index, {
                      minQty: digitsOnly(e.target.value),
                    })
                  }
                />
                <PriceInput
                  label="Price per unit"
                  min={0}
                  step="0.01"
                  value={tier.price}
                  onChange={(e) =>
                    updateBatchTier(index, { price: e.target.value })
                  }
                />
              </div>
            </div>
          ))}
        </div>

        {formError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 lg:col-span-4">
            {formError}
          </p>
        ) : null}
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding batch..." : "Add batch"}
          </Button>
        </div>
      </form>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-catalog-input" />
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : data && data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-catalog-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-catalog-text-muted">
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Selling</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Bulk tiers</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-catalog-border">
              {data.map((batch) => (
                <tr key={batch.id}>
                  <td className="px-4 py-3 font-semibold text-catalog-text">
                    #{batch.batchNumber}
                  </td>
                  <td className="px-4 py-3">{formatInr(batch.costPrice)}</td>
                  <td className="px-4 py-3">{formatInr(batch.sellingPrice)}</td>
                  <td className="px-4 py-3">{formatCount(batch.quantity)}</td>
                  <td className="px-4 py-3 text-xs">
                    {batch.bulkTiers && batch.bulkTiers.length > 0 ? (
                      <ul className="space-y-0.5">
                        {[...batch.bulkTiers]
                          .sort(
                            (a, b) => a.minimumQuantity - b.minimumQuantity,
                          )
                          .map((tier) => (
                            <li
                              key={`${batch.id}-${tier.minimumQuantity}`}
                              className="whitespace-nowrap text-catalog-text"
                            >
                              ≥{formatCount(tier.minimumQuantity)} →{" "}
                              {formatInr(tier.pricePerUnit)}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <span className="text-catalog-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-catalog-text-muted">
                    {new Date(batch.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-catalog-border bg-catalog-surface/70 px-4 py-6 text-center text-sm text-catalog-text-muted">
          No batches yet. Add the first batch to start selling this product.
        </p>
      )}
    </section>
  );
}
