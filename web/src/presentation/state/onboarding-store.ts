"use client";

import { create } from "zustand";

type OnboardingState = {
  completed: boolean;
  complete: () => void;
  setCompleted: (completed: boolean) => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  complete: () => set({ completed: true }),
  setCompleted: (completed) => set({ completed }),
}));
