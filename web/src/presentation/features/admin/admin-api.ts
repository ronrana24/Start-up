"use client";

import type { AuthSession } from "@application/ports/auth-session";
import { DomainError } from "@domain/errors";
import {
  apiJsonAuthorized,
  apiJsonPost,
} from "@infrastructure/http/http-client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AdminRoleFilter = "BUYER" | "ADMIN" | "RIDER" | "ALL";
export type AdminAnalyticsRange = "7d" | "30d" | "90d" | "all";
export type PricingDiscountType = "PERCENT_OFF" | "AMOUNT_OFF";
export type ProductUnit = "PIECE" | "PACK";
export type OrderStatus =
  | "PLACED"
  | "RIDER_ASSIGNED"
  | "PICKED_UP"
  | "CONFIRMED"
  | "PACKED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

type ApiEnvelope<T> = { data: T };
type PreparedProductImageUpload = {
  originalName: string;
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
  publicUrl: string;
  contentType: string;
  cacheControl: string;
};

const maxProductImages = 10;
const maxProductImageBytes = 8 * 1024 * 1024;
const allowedProductImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
let supabaseStorageClient: SupabaseClient | null = null;

function unwrapBody<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL as string).trim();
}

function productImageSupabaseClient(): SupabaseClient {
  if (supabaseStorageClient) return supabaseStorageClient;
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() as string;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    throw new DomainError(
      "INVALID_INPUT",
      "Image storage is not configured. Add the Supabase publishable key.",
    );
  }
  supabaseStorageClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseStorageClient;
}

function validateProductImageFiles(files: File[]): void {
  if (files.length > maxProductImages) {
    throw new DomainError(
      "INVALID_INPUT",
      `You can upload up to ${maxProductImages} product images.`,
    );
  }
  const invalidType = files.find(
    (file) => !allowedProductImageTypes.has(file.type),
  );
  if (invalidType) {
    throw new DomainError(
      "INVALID_INPUT",
      "Only JPG, PNG, WEBP, and GIF product images are allowed.",
    );
  }
  const oversized = files.find((file) => file.size > maxProductImageBytes);
  if (oversized) {
    throw new DomainError(
      "INVALID_INPUT",
      "Product images must be 8 MB or smaller.",
    );
  }
}

export type UserRole = "BUYER" | "ADMIN" | "RIDER";

export type AdminUser = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  businessName: string;
  businessType: string;
  gstNumber: string | null;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
  _count?: { orders: number; addresses: number };
};

export type AdminAddress = {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyMeters?: number | null;
  locationSource?: string | null;
  isDefault: boolean;
};

export type AdminBulkTier = {
  minimumQuantity: number;
  pricePerUnit: number;
};

export type AdminProduct = {
  id: string;
  name: string;
  category: ProductCategoryEnum;
  unit: ProductUnit;
  piecesPerPack?: number | null;
  isPublic: boolean;
  imageUrls?: string[];
  createdAt: string;
  updatedAt: string;
  activeSellingPrice?: string | null;
  hasMultipleBatches?: boolean;
  totalAvailableQty?: number;
  batches?: Array<{
    batchId: string;
    batchNumber: number;
    sellingPrice: string;
    quantity: number;
    bulkTiers?: AdminBulkTier[];
    createdAt: string;
  }>;
};

export type ProductCategoryEnum =
  | "TISSUE_AND_HYGIENE"
  | "PARTY_AND_CELEBRATION"
  | "CLEANING_AND_FRAGRANCE"
  | "FOOD_ITEMS_AND_CONDIMENTS"
  | "TABLEWARE"
  | "PACKAGING_AND_CARRY_BAGS";

export type OrderItemPricingSnapshot = {
  source?: string;
  blendedUnitPrice?: string;
  batches?: Array<{
    batchId: string;
    batchNumber: number;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
};

export type AdminOrderItemBatchAllocation = {
  id: string;
  batchId: string;
  quantity: number;
  unitPrice: string | number;
  batch?: {
    batchNumber: number;
    sellingPrice: string | number;
    costPrice: string | number;
  } | null;
};

export type AdminOrder = {
  id: string;
  status: OrderStatus;
  deliveryType: "STANDARD" | "PRIORITY";
  deliveryFee: string | number;
  subtotalAmount: string | number;
  totalAmount: string | number;
  paymentMode?: "UPI" | "PARTIAL_UPI" | "LEGACY";
  paymentStatus?: "PENDING" | "PAID" | "PARTIALLY_PAID" | "FAILED";
  paidAmount?: string | number;
  dueAmount?: string | number;
  paymentCollectionRequired?: boolean;
  collectionStatus?: "NOT_REQUIRED" | "PENDING" | "COLLECTED" | "WAIVED";
  collectionMethod?: "CASH" | "UPI_AT_DELIVERY" | null;
  collectionInstructions?: string | null;
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
    | "roles"
  >;
  rider?: { id: string; name: string; phone: string } | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    priceApplied: string | number;
    pricingSnapshot?: OrderItemPricingSnapshot | null;
    product?: {
      id: string;
      name: string;
      category: string;
      unit: ProductUnit;
      imageUrls?: string[];
    } | null;
    batchAllocations?: AdminOrderItemBatchAllocation[];
  }>;
  paymentTransactions?: Array<{
    id: string;
    provider: string;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    amount: string | number;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  paymentAudits?: Array<{
    id: string;
    eventType: string;
    message: string | null;
    createdAt: string;
  }>;
  collectionEvents?: Array<{
    id: string;
    method: "CASH" | "UPI_AT_DELIVERY";
    amount: string | number;
    reference: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

export type AdminProfileOrder = Pick<
  AdminOrder,
  "id" | "status" | "deliveryType" | "addressSnapshot"
> & {
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  deliveryDistanceKm: number;
  user: Pick<
    AdminUser,
    "id" | "phone" | "email" | "name" | "businessName" | "roles"
  >;
  rider: {
    id: string;
    name: string;
    phone: string;
    status: "IDLE" | "BUSY";
  } | null;
};

export type AdminUserProfile = {
  profile: AdminUser & {
    isOnboardingCompleted: boolean;
    auth: {
      hasGoogleAccount: boolean;
      hasPassword: boolean;
      providers: string[];
    };
    counts: {
      addresses: number;
      orders: number;
      pricingRules: number;
    };
  };
  addresses: AdminAddress[];
  rider: {
    id: string;
    userId: string;
    name: string;
    phone: string;
    status: "IDLE" | "BUSY";
    currentLocation: unknown;
    createdAt: string;
    updatedAt: string;
    _count: { orders: number; devices: number };
    devices: Array<{
      id: string;
      platform: string | null;
      isActive: boolean;
      lastSeenAt: string;
      createdAt: string;
      updatedAt: string;
    }>;
  } | null;
  orderStats: {
    buyer: {
      totalOrders: number;
      totalRevenue: number;
      averageOrderValue: number;
      lastOrderAt: string | null;
      byStatus: Array<{ status: OrderStatus; count: number }>;
    };
    rider: {
      totalOrders: number;
      totalDistanceKm: number;
      averageDeliveryMinutes: number;
      lastOrderAt: string | null;
      byStatus: Array<{ status: OrderStatus; count: number }>;
    };
  };
  pricing: {
    totalRules: number;
    activeRules: number;
    recentRules: Array<{
      id: string;
      productId: string;
      discountType: PricingDiscountType;
      discountValue: number;
      isActive: boolean;
      adminNote: string | null;
      createdAt: string;
      updatedAt: string;
      product: Pick<AdminProduct, "id" | "name" | "category"> & {
        activeSellingPrice: number | null;
      };
      updatedByAdmin: {
        id: string;
        email: string | null;
        name: string | null;
        businessName: string;
      } | null;
    }>;
  };
  activity: {
    lastActiveAt: string | null;
    buyerRecentOrders: AdminProfileOrder[];
    riderRecentOrders: AdminProfileOrder[];
  };
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
  category: ProductCategoryEnum;
  unit: ProductUnit;
  piecesPerPack?: number;
  isPublic: boolean;
  imageUrls: string[];
  initialBatch: {
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    bulkTiers: AdminBulkTier[];
  };
};

export type UpdateAdminProductInput = {
  name?: string;
  category?: ProductCategoryEnum;
  unit?: ProductUnit;
  piecesPerPack?: number;
  isPublic?: boolean;
  imageUrls?: string[];
};

export type AdminInventoryBatch = {
  id: string;
  productId: string;
  batchNumber: number;
  costPrice: string | number;
  sellingPrice: string | number;
  quantity: number;
  bulkTiers: AdminBulkTier[];
  createdAt: string;
  updatedAt: string;
};

export type CreateInventoryBatchInput = {
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  bulkTiers: AdminBulkTier[];
};

export type UpdateInventoryBatchInput = {
  costPrice?: number;
  sellingPrice?: number;
  quantity?: number;
  bulkTiers?: AdminBulkTier[];
};

export async function listProductBatches(
  productId: string,
): Promise<AdminInventoryBatch[]> {
  return unwrapBody(
    await apiJsonAuthorized<
      AdminInventoryBatch[] | ApiEnvelope<AdminInventoryBatch[]>
    >(apiBaseUrl(), `/api/inventory/${productId}/batches`, { method: "GET" }),
  );
}

export async function createProductBatch(
  productId: string,
  input: CreateInventoryBatchInput,
): Promise<AdminInventoryBatch> {
  return unwrapBody(
    await apiJsonAuthorized<
      AdminInventoryBatch | ApiEnvelope<AdminInventoryBatch>
    >(apiBaseUrl(), `/api/inventory/${productId}/batches`, {
      method: "POST",
      body: input,
    }),
  );
}

export async function updateProductBatch(
  batchId: string,
  input: UpdateInventoryBatchInput,
): Promise<AdminInventoryBatch> {
  return unwrapBody(
    await apiJsonAuthorized<
      AdminInventoryBatch | ApiEnvelope<AdminInventoryBatch>
    >(apiBaseUrl(), `/api/inventory/batches/${batchId}`, {
      method: "PATCH",
      body: input,
    }),
  );
}

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
            roles: AuthSession["roles"];
            isOnboardingCompleted?: boolean;
          };
        }
      | ApiEnvelope<{
          accessToken: string;
          user: {
            id: string;
            phone: string | null;
            roles: AuthSession["roles"];
            isOnboardingCompleted?: boolean;
          };
        }>
    >(apiBaseUrl(), "/api/auth/admin/login", input),
  );
  return {
    accessToken: body.accessToken,
    userId: body.user.id,
    phone: body.user.phone,
    roles: body.user.roles,
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

export async function getAdminUserProfile(
  userId: string,
): Promise<AdminUserProfile> {
  return unwrapBody(
    await apiJsonAuthorized<AdminUserProfile | ApiEnvelope<AdminUserProfile>>(
      apiBaseUrl(),
      `/api/admin/users/${userId}`,
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
  validateProductImageFiles(files);
  const supabase = productImageSupabaseClient();
  let payload: { uploads: PreparedProductImageUpload[] };
  try {
    payload = unwrapBody(
      await apiJsonAuthorized<
        | { uploads: PreparedProductImageUpload[] }
        | ApiEnvelope<{ uploads: PreparedProductImageUpload[] }>
      >(apiBaseUrl(), "/api/products/uploads", {
        method: "POST",
        body: {
          files: files.map((file) => ({
            originalName: file.name,
            contentType: file.type,
            size: file.size,
          })),
        },
      }),
    );
  } catch (err) {
    if (err instanceof DomainError) {
      throw err;
    }
    throw new DomainError(
      "NETWORK",
      "No internet connection. Check your network and try again.",
    );
  }

  if (payload.uploads.length !== files.length) {
    throw new DomainError(
      "INVALID_INPUT",
      "Image upload could not be prepared. Try again.",
    );
  }

  const publicUrls: string[] = [];
  for (const [index, upload] of payload.uploads.entries()) {
    const file = files[index];
    if (!file) continue;
    const { error } = await supabase.storage
      .from(upload.bucket)
      .uploadToSignedUrl(upload.path, upload.token, file, {
        cacheControl: upload.cacheControl,
        contentType: upload.contentType || file.type,
        upsert: false,
      });
    if (error) {
      throw new DomainError(
        "INVALID_INPUT",
        `Could not upload ${file.name}. Please try again.`,
      );
    }
    publicUrls.push(upload.publicUrl);
  }
  return publicUrls;
}

export async function listAdminOrders(
  page = 1,
  pageSize = 100,
  status?: OrderStatus | "ALL",
  userId?: string,
): Promise<Paginated<AdminOrder>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (status && status !== "ALL") {
    params.set("status", status);
  }
  if (userId) {
    params.set("userId", userId);
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

/**
 * Permanently removes a buyer's special price for a product. The product
 * reverts to its batch price for that buyer; the change history is retained
 * server-side (a final REMOVED audit entry is written before deletion).
 */
export async function removePricingRule(
  ruleId: string,
  reason: string,
): Promise<void> {
  await apiJsonAuthorized<unknown>(
    apiBaseUrl(),
    `/api/admin/pricing-rules/${ruleId}`,
    { method: "DELETE", body: { reason } },
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

export async function setUserRoles(
  userId: string,
  roles: UserRole[],
): Promise<{ id: string; roles: UserRole[] }> {
  return unwrapBody(
    await apiJsonAuthorized<
      { id: string; roles: UserRole[] } | ApiEnvelope<{ id: string; roles: UserRole[] }>
    >(apiBaseUrl(), `/api/admin/users/${userId}/roles`, {
      method: "PATCH",
      body: { roles },
    }),
  );
}
