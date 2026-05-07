"use client";

import type { OrderListPeriod } from "@application/ports/order-reader";
import { listOrders } from "@application/use-cases/list-orders";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { queryKeys } from "@presentation/query-keys";
import { useQuery } from "@tanstack/react-query";

export function useOrdersQuery(
  userId: string | null | undefined,
  period: OrderListPeriod = "this_month",
) {
  const deps = useAppDependencies();
  return useQuery({
    queryKey: userId ? queryKeys.orders(userId, period) : ["orders", "none"],
    enabled: Boolean(userId),
    queryFn: () => listOrders(deps, userId!, period),
  });
}
