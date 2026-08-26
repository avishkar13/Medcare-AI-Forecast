"use client";

import type { ReactNode } from "react";

// todo: mount next-themes with attribute="class" and defaultTheme="system".
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
