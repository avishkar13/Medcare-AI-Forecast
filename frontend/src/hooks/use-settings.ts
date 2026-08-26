"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { getSettings, updateSettings } from "@/lib/api/settings";
import type { AppSettings } from "@/types/settings";

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: getSettings,
    staleTime: STALE_TIME.reference,
  });
}

export function useSaveSettings() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => updateSettings(patch),
    // the response is the whole tree after merging, so seed the cache with it
    onSuccess: (saved) => client.setQueryData(queryKeys.settings.all, saved),
  });
}
