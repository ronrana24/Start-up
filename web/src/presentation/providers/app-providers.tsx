"use client";

import { createAppDependencies } from "@infrastructure/composition-root";
import { AppDependenciesProvider } from "@presentation/context/app-dependencies-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useState } from "react";
import { SessionBootstrap } from "./session-bootstrap";

function MaybeGoogleOAuthProvider({ children }: { children: React.ReactNode }) {
  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();
  if (!clientId) {
    return <>{children}</>;
  }
  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [deps] = useState(() => createAppDependencies());
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <MaybeGoogleOAuthProvider>
      <AppDependenciesProvider value={deps}>
        <QueryClientProvider client={queryClient}>
          <SessionBootstrap />
          <div className="flex min-h-full flex-1 flex-col">{children}</div>
          {process.env.NODE_ENV === "development" ? (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          ) : null}
        </QueryClientProvider>
      </AppDependenciesProvider>
    </MaybeGoogleOAuthProvider>
  );
}
