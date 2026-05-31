"use client";

import { useOrdersQuery } from "@presentation/hooks/use-orders-query";
import { useMemo } from "react";

/**
 * Active orders the buyer can still track. Mirrors the same cache as the
 * tracking hub (`useOrdersQuery(userId, "all_time")`) so the nav badge and the
 * tracking screen stay in sync without an extra request.
 *
 * "Active" = anything except the terminal {@code delivered} state. The buyer
 * list endpoint already filters out cancelled/failed orders (it only surfaces
 * PAID / PARTIALLY_PAID), so excluding {@code delivered} here is sufficient.
 */
export function useActiveOrdersCountQuery(
  userId: string | null | undefined,
): number {
  const { data } = useOrdersQuery(userId, "all_time");
  return useMemo(
    () => (data ?? []).filter((order) => order.status !== "delivered").length,
    [data],
  );
}
