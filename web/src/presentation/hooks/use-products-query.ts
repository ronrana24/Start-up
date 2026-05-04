"use client";

import { listProducts } from "@application/use-cases/list-products";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { queryKeys } from "@presentation/query-keys";
import { useQuery } from "@tanstack/react-query";

export function useProductsQuery() {
  const deps = useAppDependencies();
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => listProducts(deps),
  });
}
