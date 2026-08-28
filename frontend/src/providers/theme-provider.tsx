"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The real provider.
 *
 * This was a stub returning its children unchanged, so nothing ever wrote the `class`
 * on `<html>` - which meant every dark-mode style in the app was unreachable and the
 * theme control in Settings could not take effect however it was wired.
 *
 * `attribute="class"` because the stylesheet is Tailwind's class strategy;
 * `defaultTheme="system"` so a first visit follows the operating system rather than
 * asserting a preference nobody expressed. `<html>` already carries
 * `suppressHydrationWarning`, which is required: the theme is only knowable in the
 * browser, so the server-rendered markup cannot match it.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
