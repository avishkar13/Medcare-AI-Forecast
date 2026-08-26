"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { isApiError } from "@/lib/api";
import { STALE_TIME } from "@/config/constants";

export function QueryProvider({ children }: { children: ReactNode }) {
  // created in state so the client is per-mount. a module-level client would be
  // shared across requests when rendered on the server.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME.list,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // a 4xx fails the same way next time. only retry what might recover.
              if (isApiError(error) && !error.isRetryable) return false;
              return failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
