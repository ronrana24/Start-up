"use client";

import { listProducts } from "@application/use-cases/list-products";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { queryKeys } from "@presentation/query-keys";
import { useAuthStore } from "@presentation/state/auth-store";
import { useQuery } from "@tanstack/react-query";

export function useProductsQuery() {
  const deps = useAppDependencies();
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: queryKeys.products(userId),
    queryFn: () => listProducts(deps),
  });
}
