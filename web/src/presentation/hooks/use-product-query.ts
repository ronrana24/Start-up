"use client";

import { getProductById } from "@application/use-cases/get-product-by-id";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { queryKeys } from "@presentation/query-keys";
import { useAuthStore } from "@presentation/state/auth-store";
import { useQuery } from "@tanstack/react-query";

export function useProductQuery(productId: string | undefined) {
  const deps = useAppDependencies();
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: productId
      ? queryKeys.product(productId, userId)
      : ["products", "none"],
    enabled: Boolean(productId),
    queryFn: () => getProductById(deps, productId!),
  });
}
