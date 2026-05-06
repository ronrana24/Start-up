"use client";

import { useQuery } from "@tanstack/react-query";

export function useAdminQuery<T>(
  queryKey: readonly unknown[],
  loader: () => Promise<T>,
) {
  const query = useQuery({
    queryKey,
    queryFn: loader,
  });

  return {
    data: query.data ?? null,
    error: query.error instanceof Error ? query.error.message : null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
