"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "./query-provider";
import { RealtimeProvider } from "./realtime-provider";
import { ThemeProvider } from "./theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        {/* Inside QueryProvider: it invalidates queries, so it needs the client. */}
        <RealtimeProvider>
          {children}
          <Toaster position="top-right" closeButton richColors />
        </RealtimeProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
