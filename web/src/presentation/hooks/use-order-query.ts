"use client";

import { getOrder } from "@application/use-cases/get-order";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { queryKeys } from "@presentation/query-keys";
import { useQuery } from "@tanstack/react-query";

export function useOrderQuery(
  orderId: string | undefined,
  userId: string | null | undefined,
) {
  const deps = useAppDependencies();
  return useQuery({
    queryKey:
      orderId && userId
        ? queryKeys.order(userId, orderId)
        : ["orders", "detail", "none"],
    enabled: Boolean(orderId && userId),
    queryFn: () => getOrder(deps, orderId!, userId!),
  });
}
