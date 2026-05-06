"use client";

import type { AuthSession } from "@application/ports/auth-session";
import { create } from "zustand";

type AuthState = {
  phone: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  hasCheckedSession: boolean;
  userId: string | null;
  role: AuthSession["role"] | null;
  isOnboardingCompleted: boolean;
  setSession: (session: AuthSession) => void;
  markOnboardingCompleted: () => void;
  markSessionChecked: () => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  phone: null,
  accessToken: null,
  isAuthenticated: false,
  hasCheckedSession: false,
  userId: null,
  role: null,
  isOnboardingCompleted: false,
  setSession: (session: AuthSession) =>
    set({
      phone: session.phone,
      accessToken: session.accessToken,
      isAuthenticated: true,
      hasCheckedSession: true,
      userId: session.userId,
      role: session.role,
      isOnboardingCompleted: session.isOnboardingCompleted,
    }),
  markOnboardingCompleted: () => set({ isOnboardingCompleted: true }),
  markSessionChecked: () => set({ hasCheckedSession: true }),
  clearSession: () =>
    set({
      phone: null,
      accessToken: null,
      isAuthenticated: false,
      hasCheckedSession: true,
      userId: null,
      role: null,
      isOnboardingCompleted: false,
    }),
}));
