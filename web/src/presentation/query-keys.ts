export const queryKeys = {
  products: (userId?: string | null) => ["products", userId ?? "anon"] as const,
  product: (id: string, userId?: string | null) =>
    ["products", userId ?? "anon", id] as const,
  orders: (userId: string) => ["orders", userId] as const,
  order: (userId: string, orderId: string) =>
    ["orders", userId, orderId] as const,
};
