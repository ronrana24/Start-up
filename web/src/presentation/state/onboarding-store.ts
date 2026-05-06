"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type OnboardingState = {
  completed: boolean;
  complete: () => void;
  setCompleted: (completed: boolean) => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      complete: () => set({ completed: true }),
      setCompleted: (completed) => set({ completed }),
    }),
    { name: "shop-onboarding" },
  ),
);
