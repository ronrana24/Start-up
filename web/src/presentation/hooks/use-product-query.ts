"use client";

import { getProductById } from "@application/use-cases/get-product-by-id";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { queryKeys } from "@presentation/query-keys";
import { useQuery } from "@tanstack/react-query";

export function useProductQuery(productId: string | undefined) {
  const deps = useAppDependencies();
  return useQuery({
    queryKey: productId ? queryKeys.product(productId) : ["products", "none"],
    enabled: Boolean(productId),
    queryFn: () => getProductById(deps, productId!),
  });
}
