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
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: queryKeys.settings.all });
      const previousSettings = client.getQueryData<AppSettings>(queryKeys.settings.all);
      
      if (previousSettings) {
        // Deep merge the sections that might be patched
        const nextSettings = { ...previousSettings };
        if (patch.general) nextSettings.general = { ...nextSettings.general, ...patch.general };
        if (patch.alerts) nextSettings.alerts = { ...nextSettings.alerts, ...patch.alerts };
        if (patch.notifications) nextSettings.notifications = { ...nextSettings.notifications, ...patch.notifications };
        if (patch.ai) nextSettings.ai = { ...nextSettings.ai, ...patch.ai };
        
        client.setQueryData<AppSettings>(queryKeys.settings.all, nextSettings);
      }
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      if (context?.previousSettings) {
        client.setQueryData(queryKeys.settings.all, context.previousSettings);
      }
    },
    // the response is the whole tree after merging, so seed the cache with it
    onSuccess: (saved) => client.setQueryData(queryKeys.settings.all, saved),
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}
