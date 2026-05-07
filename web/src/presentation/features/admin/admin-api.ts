"use client";

import type { AuthSession } from "@application/ports/auth-session";
import { DomainError } from "@domain/errors";
import {
  apiJsonAuthorized,
  apiJsonPost,
  readApiErrorMessage,
} from "@infrastructure/http/http-client";

export type AdminRoleFilter = "BUYER" | "ADMIN" | "RIDER" | "ALL";
export type AdminAnalyticsRange = "7d" | "30d" | "90d" | "all";
export type PricingDiscountType = "PERCENT_OFF" | "AMOUNT_OFF";
export type ProductUnit = "PIECE" | "PACK";
export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "PACKED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

type ApiEnvelope<T> = { data: T };

function unwrapBody<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
}

function apiUrl(path: string): string {
  const base = apiBaseUrl().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export type AdminUser = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  businessName: string;
  businessType: string;
  gstNumber: string | null;
  role: AuthSession["role"];
  createdAt: string;
  updatedAt: string;
  _count?: { orders: number; addresses: number };
};

export type AdminProduct = {
  id: string;
  name: string;
  category: string;
  unit: ProductUnit;
  piecesPerPack?: number | null;
  isPublic: boolean;
  basePrice: string | number;
  imageUrls?: string[];
  bulkPricingTiers: Array<{ minQty: number; price: number }>;
  createdAt: string;
  updatedAt: string;
  inventory?: {
    availableQty: number;
    reservedQty: number;
    warehouseId: string;
  } | null;
};

export type AdminOrder = {
  id: string;
  status: OrderStatus;
  deliveryType: "STANDARD" | "PRIORITY";
  deliveryFee: string | number;
  subtotalAmount: string | number;
  totalAmount: string | number;
  addressSnapshot?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<
    AdminUser,
    | "id"
    | "phone"
    | "email"
    | "name"
    | "businessName"
    | "businessType"
    | "gstNumber"
    | "role"
  >;
  rider?: { id: string; name: string; phone: string } | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    priceApplied: string | number;
    product?: {
      id: string;
      name: string;
      category: string;
      unit: ProductUnit;
      imageUrls?: string[];
    } | null;
  }>;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminAnalytics = {
  range: AdminAnalyticsRange;
  totals: {
    revenue: number;
    orders: number;
    buyers: number;
    activeBuyers: number;
    inactiveBuyers: number;
    products: number;
    averageOrderValue: number;
  };
  insights: Array<{ title: string; value: string; detail: string }>;
  ordersByStatus: Array<{ status: OrderStatus; count: number }>;
  revenueTrend: Array<{ date: string; revenue: number; orders: number }>;
  repeatBuyerTrend: Array<{
    date: string;
    newBuyers: number;
    repeatBuyers: number;
  }>;
  buyersByLocation: Array<{
    city: string;
    state: string;
    location: string;
    buyers: number;
    orders: number;
    revenue: number;
  }>;
  topBuyers: Array<{
    userId: string;
    businessName: string;
    phone: string;
    email: string | null;
    orders: number;
    revenue: number;
    lastOrderAt: string | null;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
  }>;
  topCategories: Array<{
    category: string;
    quantity: number;
    revenue: number;
  }>;
  lowStock: Array<{
    productId: string;
    name: string;
    category: string;
    availableQty: number;
    reservedQty: number;
  }>;
};

export type AdminUserAnalytics = {
  range: AdminAnalyticsRange;
  profile: {
    id: string;
    phone: string;
    email: string | null;
    name: string | null;
    businessName: string;
    businessType: string;
    gstNumber: string | null;
    createdAt: string;
    updatedAt: string;
    location: { city: string; state: string; location: string };
  };
  totals: {
    revenue: number;
    orders: number;
    completedOrders: number;
    averageOrderValue: number;
    itemsBought: number;
    lastOrderAt: string | null;
  };
  insights: Array<{ title: string; value: string; detail: string }>;
  purchaseTimeline: Array<{
    date: string;
    revenue: number;
    orders: number;
    quantity: number;
  }>;
  productsBought: Array<{
    productId: string;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
    orders: number;
    firstPurchasedAt: string;
    lastPurchasedAt: string;
  }>;
  categoryBreakdown: Array<{
    category: string;
    quantity: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    status: OrderStatus;
    totalAmount: number;
    createdAt: string;
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
      revenue: number;
    }>;
  }>;
};

export type AdminProductAnalytics = {
  range: AdminAnalyticsRange;
  product: {
    id: string;
    name: string;
    category: string;
  };
  totals: {
    quantityOrdered: number;
    orders: number;
    buyers: number;
    revenue: number;
    averageUnitPrice: number;
  };
  orderTrend: Array<{
    date: string;
    quantity: number;
    revenue: number;
    orders: number;
  }>;
  ordersByLocation: Array<{
    city: string;
    state: string;
    location: string;
    quantity: number;
    orders: number;
    revenue: number;
  }>;
};

export type CreateAdminProductInput = {
  name: string;
  category: string;
  unit: ProductUnit;
  piecesPerPack?: number;
  isPublic: boolean;
  basePrice: number;
  imageUrls: string[];
  initialAvailableQty: number;
  bulkPricingTiers: Array<{ minQty: number; price: number }>;
};

export type UpdateAdminProductInput = CreateAdminProductInput;

export type AdminPricingRule = {
  id: string;
  userId: string;
  productId: string;
  discountType: PricingDiscountType;
  discountValue: string | number;
  isActive: boolean;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  product?: AdminProduct;
  updatedByAdmin?: {
    id: string;
    email: string | null;
    name: string | null;
    businessName: string;
  } | null;
};

export type AdminPricingRuleAudit = {
  id: string;
  action: "CREATED" | "UPDATED" | "DISABLED" | "ENABLED";
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  createdAt: string;
  changedByAdmin?: {
    id: string;
    email: string | null;
    name: string | null;
    businessName: string;
  } | null;
};

export type UpsertAdminPricingRuleInput = {
  discountType: PricingDiscountType;
  discountValue: number;
  reason: string;
  adminNote?: string;
};

export async function adminLogin(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const body = unwrapBody(
    await apiJsonPost<
      | {
          accessToken: string;
          user: {
            id: string;
            phone: string | null;
            role: AuthSession["role"];
            isOnboardingCompleted?: boolean;
          };
        }
      | ApiEnvelope<{
          accessToken: string;
          user: {
            id: string;
            phone: string | null;
            role: AuthSession["role"];
            isOnboardingCompleted?: boolean;
          };
        }>
    >(apiBaseUrl(), "/api/auth/admin/login", input),
  );
  return {
    accessToken: body.accessToken,
    userId: body.user.id,
    phone: body.user.phone,
    role: body.user.role,
    isOnboardingCompleted: body.user.isOnboardingCompleted ?? false,
  };
}

export async function getAdminAnalytics(
  range: AdminAnalyticsRange = "30d",
): Promise<AdminAnalytics> {
  const params = new URLSearchParams({ range });
  return unwrapBody(
    await apiJsonAuthorized<AdminAnalytics | ApiEnvelope<AdminAnalytics>>(
      apiBaseUrl(),
      `/api/admin/analytics?${params.toString()}`,
      { method: "GET" },
    ),
  );
}

export async function getAdminUserAnalytics(
  userId: string,
  range: AdminAnalyticsRange = "30d",
): Promise<AdminUserAnalytics> {
  const params = new URLSearchParams({ range });
  return unwrapBody(
    await apiJsonAuthorized<
      AdminUserAnalytics | ApiEnvelope<AdminUserAnalytics>
    >(
      apiBaseUrl(),
      `/api/admin/users/${userId}/analytics?${params.toString()}`,
      { method: "GET" },
    ),
  );
}

export async function getAdminProductAnalytics(
  productId: string,
  range: AdminAnalyticsRange = "30d",
): Promise<AdminProductAnalytics> {
  const params = new URLSearchParams({ range });
  return unwrapBody(
    await apiJsonAuthorized<
      AdminProductAnalytics | ApiEnvelope<AdminProductAnalytics>
    >(
      apiBaseUrl(),
      `/api/admin/products/${productId}/analytics?${params.toString()}`,
      { method: "GET" },
    ),
  );
}

export async function listAdminProducts(
  page = 1,
  pageSize = 100,
): Promise<Paginated<AdminProduct>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return unwrapBody(
    await apiJsonAuthorized<
      Paginated<AdminProduct> | ApiEnvelope<Paginated<AdminProduct>>
    >(apiBaseUrl(), `/api/products?${params.toString()}`, { method: "GET" }),
  );
}

export async function getAdminProduct(
  productId: string,
): Promise<AdminProduct> {
  return unwrapBody(
    await apiJsonAuthorized<AdminProduct | ApiEnvelope<AdminProduct>>(
      apiBaseUrl(),
      `/api/products/${productId}`,
      { method: "GET" },
    ),
  );
}

export async function createAdminProduct(
  input: CreateAdminProductInput,
): Promise<AdminProduct> {
  return unwrapBody(
    await apiJsonAuthorized<AdminProduct | ApiEnvelope<AdminProduct>>(
      apiBaseUrl(),
      "/api/products",
      { method: "POST", body: input },
    ),
  );
}

export async function updateAdminProduct(
  productId: string,
  input: UpdateAdminProductInput,
): Promise<AdminProduct> {
  return unwrapBody(
    await apiJsonAuthorized<AdminProduct | ApiEnvelope<AdminProduct>>(
      apiBaseUrl(),
      `/api/products/${productId}`,
      { method: "PATCH", body: input },
    ),
  );
}

export async function deleteAdminProduct(productId: string): Promise<void> {
  await apiJsonAuthorized<void>(apiBaseUrl(), `/api/products/${productId}`, {
    method: "DELETE",
  });
}

export async function uploadAdminProductImages(
  files: File[],
): Promise<string[]> {
  if (files.length === 0) return [];
  const body = new FormData();
  for (const file of files) {
    body.append("images", file);
  }
  const res = await fetch(apiUrl("/api/products/uploads"), {
    method: "POST",
    body,
    credentials: "include",
  });
  if (!res.ok) {
    throw new DomainError(
      res.status === 401 ? "UNAUTHORIZED" : "INVALID_INPUT",
      await readApiErrorMessage(res),
    );
  }
  const payload = unwrapBody(
    (await res.json()) as
      | { imageUrls: string[] }
      | ApiEnvelope<{ imageUrls: string[] }>,
  );
  return payload.imageUrls;
}

export async function listAdminOrders(
  page = 1,
  pageSize = 100,
  status?: OrderStatus | "ALL",
): Promise<Paginated<AdminOrder>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (status && status !== "ALL") {
    params.set("status", status);
  }
  return unwrapBody(
    await apiJsonAuthorized<
      Paginated<AdminOrder> | ApiEnvelope<Paginated<AdminOrder>>
    >(apiBaseUrl(), `/api/admin/orders?${params.toString()}`, {
      method: "GET",
    }),
  );
}

export async function updateAdminOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<AdminOrder> {
  return unwrapBody(
    await apiJsonAuthorized<AdminOrder | ApiEnvelope<AdminOrder>>(
      apiBaseUrl(),
      `/api/admin/orders/${orderId}/status`,
      { method: "PATCH", body: { status } },
    ),
  );
}

export async function listAdminUsers(
  role: AdminRoleFilter = "BUYER",
  page = 1,
  pageSize = 100,
): Promise<Paginated<AdminUser>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    role,
  });
  return unwrapBody(
    await apiJsonAuthorized<
      Paginated<AdminUser> | ApiEnvelope<Paginated<AdminUser>>
    >(apiBaseUrl(), `/api/admin/users?${params.toString()}`, { method: "GET" }),
  );
}

export async function listUserPricingRules(
  userId: string,
): Promise<AdminPricingRule[]> {
  return unwrapBody(
    await apiJsonAuthorized<
      AdminPricingRule[] | ApiEnvelope<AdminPricingRule[]>
    >(apiBaseUrl(), `/api/admin/users/${userId}/pricing-rules`, {
      method: "GET",
    }),
  );
}

export async function upsertUserProductPricingRule(
  userId: string,
  productId: string,
  input: UpsertAdminPricingRuleInput,
): Promise<AdminPricingRule> {
  return unwrapBody(
    await apiJsonAuthorized<AdminPricingRule | ApiEnvelope<AdminPricingRule>>(
      apiBaseUrl(),
      `/api/admin/users/${userId}/products/${productId}/pricing-rule`,
      { method: "PUT", body: input },
    ),
  );
}

export async function setPricingRuleActive(
  ruleId: string,
  isActive: boolean,
  reason: string,
): Promise<AdminPricingRule> {
  return unwrapBody(
    await apiJsonAuthorized<AdminPricingRule | ApiEnvelope<AdminPricingRule>>(
      apiBaseUrl(),
      `/api/admin/pricing-rules/${ruleId}/${isActive ? "enable" : "disable"}`,
      { method: "PATCH", body: { reason } },
    ),
  );
}

export async function getPricingRuleAudit(
  ruleId: string,
): Promise<AdminPricingRuleAudit[]> {
  return unwrapBody(
    await apiJsonAuthorized<
      AdminPricingRuleAudit[] | ApiEnvelope<AdminPricingRuleAudit[]>
    >(apiBaseUrl(), `/api/admin/pricing-rules/${ruleId}/audit`, {
      method: "GET",
    }),
  );
}
