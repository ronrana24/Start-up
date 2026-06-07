"use client";

import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { cn } from "@presentation/lib/cn";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAdminUserAnalytics,
  getPricingRuleAudit,
  listAdminProducts,
  listUserPricingRules,
  removePricingRule,
  setPricingRuleActive,
  upsertUserProductPricingRule,
  type AdminPricingRuleAudit,
  type PricingDiscountType,
} from "./admin-api";
import { formatDateTime, formatInr } from "./admin-format";
import { useAdminQuery } from "./use-admin-query";

function discountLabel(type: PricingDiscountType, value: string | number): string {
  return type === "PERCENT_OFF" ? `${Number(value)}% off` : `${formatInr(value)} off`;
}

export function AdminUserPricingScreen() {
  const params = useParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;
  const [productId, setProductId] = useState("");
  const [search, setSearch] = useState("");
  const [discountType, setDiscountType] = useState<PricingDiscountType>("PERCENT_OFF");
  const [discountValue, setDiscountValue] = useState("");
  const [reason, setReason] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [auditRuleId, setAuditRuleId] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<AdminPricingRuleAudit[]>([]);
  // Drives the brief post-navigation highlight on the Change History section.
  const [auditHighlighted, setAuditHighlighted] = useState(false);
  const historyRef = useRef<HTMLElement>(null);
  // Bumped each time "View history" is clicked so the scroll effect re-runs even
  // when the same rule's history is reopened.
  const [historyNavToken, setHistoryNavToken] = useState(0);

  const profile = useAdminQuery(
    ["admin", "user-analytics", userId, "all"],
    () => getAdminUserAnalytics(userId ?? "", "all"),
  );
  const products = useAdminQuery(
    ["admin", "products", 1, 100],
    () => listAdminProducts(1, 100),
  );
  const rules = useAdminQuery(
    ["admin", "pricing-rules", userId],
    () => listUserPricingRules(userId ?? ""),
  );

  const selectedProduct = useMemo(
    () => products.data?.items.find((product) => product.id === productId) ?? null,
    [products.data, productId],
  );
  const existingRule = useMemo(
    () => rules.data?.find((rule) => rule.productId === productId) ?? null,
    [rules.data, productId],
  );
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = products.data?.items ?? [];
    if (!q) return items.slice(0, 12);
    return items
      .filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          product.category.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [products.data, search]);

  const previewPrice = useMemo(() => {
    if (!selectedProduct) return null;
    // SPECIAL pricing now applies on top of the active batch's selling price,
    // since product-level basePrice no longer exists.
    const activeSellingPrice = Number(selectedProduct.activeSellingPrice ?? 0);
    const value = Number(discountValue);
    if (!Number.isFinite(activeSellingPrice) || !Number.isFinite(value))
      return null;
    if (discountType === "PERCENT_OFF") {
      return Math.max(0, activeSellingPrice * (1 - value / 100));
    }
    return Math.max(0, activeSellingPrice - value);
  }, [selectedProduct, discountType, discountValue]);

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !productId) return;
    setError(null);
    setIsSaving(true);
    try {
      await upsertUserProductPricingRule(userId, productId, {
        discountType,
        discountValue: Number(discountValue),
        reason: reason.trim(),
        adminNote: adminNote.trim() || undefined,
      });
      setReason("");
      await rules.refetch();
    } catch (err) {
      setError(domainErrorMessage(err, "Could not save pricing rule"));
    } finally {
      setIsSaving(false);
    }
  }

  function selectProduct(nextProductId: string) {
    const rule = rules.data?.find((row) => row.productId === nextProductId);
    setProductId(nextProductId);
    setReason("");
    if (rule) {
      setDiscountType(rule.discountType);
      setDiscountValue(String(rule.discountValue));
      setAdminNote(rule.adminNote ?? "");
      return;
    }
    setDiscountType("PERCENT_OFF");
    setDiscountValue("");
    setAdminNote("");
  }

  async function toggleRule(ruleId: string, nextActive: boolean) {
    const promptText = nextActive
      ? "Reason for enabling this special price"
      : "Reason for disabling this special price";
    const toggleReason = window.prompt(promptText);
    if (!toggleReason?.trim()) return;
    setError(null);
    try {
      await setPricingRuleActive(ruleId, nextActive, toggleReason.trim());
      await rules.refetch();
    } catch (err) {
      setError(domainErrorMessage(err, "Could not update pricing rule"));
    }
  }

  async function removeRule(ruleId: string, productName: string) {
    const confirmed = window.confirm(
      `Remove the special price for "${productName}" completely? This buyer will revert to standard batch pricing for this product. This cannot be undone.`,
    );
    if (!confirmed) return;
    const removeReason = window.prompt(
      "Reason for removing this special price",
    );
    if (!removeReason?.trim()) return;
    setError(null);
    try {
      await removePricingRule(ruleId, removeReason.trim());
      // If the removed rule's history panel was open, close it (the rule is gone).
      if (auditRuleId === ruleId) {
        setAuditRuleId(null);
        setAuditRows([]);
      }
      await rules.refetch();
    } catch (err) {
      setError(domainErrorMessage(err, "Could not remove pricing rule"));
    }
  }

  async function loadAudit(ruleId: string) {
    // Expand the Change History section first (it is conditionally rendered),
    // then bump the nav token so the scroll-into-view effect runs once the
    // section has mounted.
    setAuditRuleId(ruleId);
    setHistoryNavToken((token) => token + 1);
    setAuditRows(await getPricingRuleAudit(ruleId));
  }

  // Smooth-scroll to the Change History section and briefly highlight it
  // whenever "View history" is clicked. Runs after the section mounts/updates,
  // so a collapsed section is expanded (via auditRuleId) before we scroll.
  useEffect(() => {
    if (historyNavToken === 0) return;
    const node = historyRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    setAuditHighlighted(true);
    const timer = window.setTimeout(() => setAuditHighlighted(false), 1600);
    return () => window.clearTimeout(timer);
  }, [historyNavToken]);

  if (!userId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Buyer id is missing.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/users"
            className="text-xs font-bold uppercase tracking-wide text-catalog-green hover:underline"
          >
            All users
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-catalog-text">
            Special pricing
          </h1>
          <p className="text-sm text-catalog-text-muted">
            {profile.data?.profile.businessName ?? "Buyer"} /{" "}
            {profile.data?.profile.phone ?? userId}
          </p>
        </div>
        <Link
          href={`/admin/users/${userId}/analytics`}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-catalog-border bg-card px-4 text-sm font-bold text-catalog-text hover:bg-catalog-input"
        >
          Buyer analytics
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          className="space-y-4 rounded-xl border border-catalog-border bg-card p-4 shadow-sm"
          onSubmit={saveRule}
        >
          <div>
            <h2 className="text-sm font-bold text-catalog-text">
              Assign product discount
            </h2>
            <p className="text-xs text-catalog-text-muted">
              Custom pricing overrides bulk pricing for the selected buyer.
            </p>
          </div>

          <Input
            label="Search product"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or category"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredProducts.map((product) => {
              const active = product.id === productId;
              return (
                <button
                  key={product.id}
                  type="button"
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-catalog-green bg-catalog-green-muted"
                      : "border-catalog-border bg-catalog-surface hover:bg-catalog-input",
                  )}
                  onClick={() => selectProduct(product.id)}
                >
                  <p className="line-clamp-1 text-sm font-bold text-catalog-text">
                    {product.name}
                  </p>
                  <p className="text-xs text-catalog-text-muted">
                    {product.category}
                    {product.activeSellingPrice
                      ? ` / ${formatInr(product.activeSellingPrice)}`
                      : ""}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex w-full flex-col gap-1.5 text-sm">
              <span className="font-medium text-heading">Discount type</span>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as PricingDiscountType)}
                className="min-h-11 rounded-lg border border-input-border bg-input-bg px-3 text-heading outline-none focus:border-border-focus focus:ring-2 focus:ring-primary/20"
              >
                <option value="PERCENT_OFF">Percent off</option>
                <option value="AMOUNT_OFF">Amount off</option>
              </select>
            </label>
            <Input
              label={discountType === "PERCENT_OFF" ? "Discount percent" : "Discount amount"}
              type="number"
              min="0.01"
              step="0.01"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              required
            />
          </div>

          {selectedProduct ? (
            <div className="rounded-lg border border-catalog-green-border bg-catalog-green-muted p-3 text-sm">
              <span className="text-catalog-text-muted">Buyer sees </span>
              <strong className="text-catalog-text">
                {previewPrice == null ? "a calculated special price" : formatInr(previewPrice)}
              </strong>
              <span className="text-catalog-text-muted"> instead of </span>
              <span className="line-through">
                {selectedProduct.activeSellingPrice
                  ? formatInr(selectedProduct.activeSellingPrice)
                  : "the active batch price"}
              </span>
            </div>
          ) : null}

          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this price being changed?"
            required
          />
          <Input
            label="Admin note"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Internal note, hidden from buyer"
          />

          <Button type="submit" disabled={!productId || isSaving}>
            {isSaving ? "Saving..." : existingRule ? "Update special price" : "Create special price"}
          </Button>
        </form>

        <section className="rounded-xl border border-catalog-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-bold text-catalog-text">Active rules</h2>
          <div className="mt-3 space-y-3">
            {(rules.data ?? []).map((rule) => (
              <div key={rule.id} className="rounded-lg border border-catalog-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-catalog-text">
                      {rule.product?.name ?? rule.productId}
                    </p>
                    <p className="text-xs text-catalog-text-muted">
                      {discountLabel(rule.discountType, rule.discountValue)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px] font-bold",
                      rule.isActive
                        ? "bg-catalog-green-muted text-catalog-green"
                        : "bg-catalog-input text-catalog-text-muted",
                    )}
                  >
                    {rule.isActive ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-catalog-border/60 pt-3">
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-catalog-green-border bg-catalog-green-muted px-3.5 py-2 text-sm font-bold text-catalog-green shadow-sm transition-colors hover:bg-catalog-green hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-catalog-green/40 focus-visible:ring-offset-1"
                    onClick={() => void loadAudit(rule.id)}
                  >
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M3 12a9 9 0 1 0 3-6.7" />
                      <path d="M3 4v5h5" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                    View history
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-catalog-blue/30 bg-catalog-blue-light/40 px-3.5 py-2 text-sm font-bold text-catalog-blue shadow-sm transition-colors hover:bg-catalog-blue hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-catalog-blue/40 focus-visible:ring-offset-1"
                    onClick={() => void toggleRule(rule.id, !rule.isActive)}
                  >
                    {rule.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-bold text-red-600 shadow-sm transition-colors hover:bg-red-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-1"
                    onClick={() =>
                      void removeRule(
                        rule.id,
                        rule.product?.name ?? rule.productId,
                      )
                    }
                  >
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                    </svg>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {rules.data?.length === 0 ? (
              <p className="rounded-lg bg-catalog-surface p-4 text-sm text-catalog-text-muted">
                No special prices for this buyer yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {auditRuleId ? (
        <section
          ref={historyRef}
          aria-label="Change history"
          className={cn(
            "scroll-mt-24 rounded-xl border bg-card p-4 shadow-sm transition-[box-shadow,border-color] duration-500",
            auditHighlighted
              ? "border-catalog-green ring-2 ring-catalog-green/40"
              : "border-catalog-border",
          )}
        >
          <h2 className="text-sm font-bold text-catalog-text">Change history</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase text-catalog-text-muted">
                <tr>
                  <th className="py-2">Action</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2">Admin</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-border">
                {auditRows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 font-bold text-catalog-text">
                      {row.action}
                    </td>
                    <td className="py-2">{row.reason}</td>
                    <td className="py-2">
                      {row.changedByAdmin?.email ??
                        row.changedByAdmin?.businessName ??
                        "Unknown"}
                    </td>
                    <td className="py-2 text-xs text-catalog-text-muted">
                      {formatDateTime(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
