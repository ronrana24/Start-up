"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type OnboardingState = {
  completed: boolean;
  complete: () => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      complete: () => set({ completed: true }),
    }),
    { name: "shop-onboarding" },
  ),
);
