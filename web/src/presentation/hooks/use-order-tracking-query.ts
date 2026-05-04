"use client";

import { getOrderTracking } from "@application/use-cases/get-order-tracking";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { queryKeys } from "@presentation/query-keys";
import { useQuery } from "@tanstack/react-query";

export function useOrderTrackingQuery(
  orderId: string | undefined,
  userId: string | null | undefined,
) {
  const deps = useAppDependencies();
  return useQuery({
    queryKey:
      orderId && userId
        ? queryKeys.order(userId, orderId)
        : ["orders", "tracking", "none"],
    enabled: Boolean(orderId && userId),
    queryFn: () => getOrderTracking(deps, orderId!, userId!),
  });
}
