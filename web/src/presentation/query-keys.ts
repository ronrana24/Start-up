export const queryKeys = {
  products: ["products"] as const,
  product: (id: string) => ["products", id] as const,
  orders: (userId: string) => ["orders", userId] as const,
  order: (userId: string, orderId: string) =>
    ["orders", userId, orderId] as const,
};
