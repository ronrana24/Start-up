"use client";

import type { PlaceOrderInput } from "@application/ports/order-writer";
import { placeOrder } from "@application/use-cases/place-order";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { queryKeys } from "@presentation/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function usePlaceOrderMutation(userId: string | null | undefined) {
  const deps = useAppDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceOrderInput) => placeOrder(deps, input),
    onSuccess: (order) => {
      if (userId) {
        queryClient.setQueryData(queryKeys.order(userId, order.id), order);
        void queryClient.invalidateQueries({ queryKey: queryKeys.orders(userId) });
      }
    },
  });
}
