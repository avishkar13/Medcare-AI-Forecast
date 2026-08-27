"use client";

import { useEffect, useState } from "react";

/**
 * Delays a value so a per-keystroke filter does not become a per-keystroke request.
 * Used by the pages that push their search box to the server.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
