"use client";

import type { AppDependencies } from "@application/app-dependencies";
import { createContext, useContext } from "react";

const AppDependenciesContext = createContext<AppDependencies | null>(null);

export function AppDependenciesProvider({
  value,
  children,
}: {
  value: AppDependencies;
  children: React.ReactNode;
}) {
  return (
    <AppDependenciesContext.Provider value={value}>
      {children}
    </AppDependenciesContext.Provider>
  );
}

export function useAppDependencies(): AppDependencies {
  const ctx = useContext(AppDependenciesContext);
  if (!ctx) {
    throw new Error("useAppDependencies must be used within AppDependenciesProvider");
  }
  return ctx;
}
