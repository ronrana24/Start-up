export function mergeQuantitiesByProductId(
  items: { productId: string; quantity: number }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const it of items) {
    map.set(it.productId, (map.get(it.productId) ?? 0) + it.quantity);
  }
  return map;
}
