"use client";

import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CreateAdminProductInput, ProductUnit } from "./admin-api";
import { createAdminProduct } from "./admin-api";

type Tier = { minQty: string; price: string };

export function AdminProductNewScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("PACK");
  const [basePrice, setBasePrice] = useState("");
  const [initialAvailableQty, setInitialAvailableQty] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([{ minQty: "", price: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function addTier() {
    setTiers((current) => [...current, { minQty: "", price: "" }]);
  }

  function updateTier(index: number, patch: Partial<Tier>) {
    setTiers((current) =>
      current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    );
  }

  function payload(): CreateAdminProductInput | null {
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
      initialAvailableQty: Math.floor(parsedStock),
      bulkPricingTiers: parsedTiers,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = payload();
    if (!input) {
      setError("Please complete product fields with valid prices and stock.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
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
            {isSaving ? "Creating..." : "Create Product"}
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
